import { describe, expect, it } from 'bun:test';
import { extractRunScript, readWorkflow } from './workflow-test-helpers';

const consumer = await readWorkflow('pr-preview-deploy.yml');
const validation = extractRunScript(
  consumer,
  'Validate the exact host command',
);
const keyResolution = extractRunScript(
  consumer,
  'Resolve the dedicated preview SSH key',
);
const cleanupStepName = 'Remove temporary key material';
const cleanupStepStart = consumer.indexOf(`      - name: ${cleanupStepName}\n`);
const cleanupStepHeader = consumer.slice(
  cleanupStepStart,
  consumer.indexOf('        run: |\n', cleanupStepStart),
);
const cleanup = extractRunScript(consumer, cleanupStepName);
const secretInterpolationPattern =
  /\$\{?(?:SOPS_AGE_KEY|identity|key|public_key|fingerprint)\b/u;
const keyFailureContracts = [
  [
    'if ! grep --quiet --extended-regexp \'^AGE-SECRET-KEY-1[A-Z0-9]{58}$\' "$identity"; then',
    'The protected preview age identity has an invalid format',
  ],
  [
    'if ! echo "$sha  $sops" | sha256sum --check --quiet; then',
    'The pinned SOPS download failed checksum verification',
  ],
  [
    'if ! SOPS_AGE_KEY_FILE="$identity" "$sops" decrypt \\',
    'The protected preview age identity cannot decrypt the current main secret',
  ],
  ['[ ! -s "$key" ]', 'The decrypted preview SSH key is empty'],
  [
    'if ! public_key=$(ssh-keygen -y -f "$key"); then',
    'The decrypted preview SSH key is invalid',
  ],
  [
    '[[ ! "$public_key" =~ ^ssh-ed25519',
    'The decrypted preview SSH key has an unexpected type',
  ],
  [
    '[ "$fingerprint" !=',
    'The decrypted preview SSH key does not match the pinned deploy key',
  ],
] as const;
const headShaLength = 40;
const digestHexLength = 64;
const headSha = '1'.repeat(headShaLength);
const image = `ghcr.io/davidvornholt/wordhold@sha256:${'a'.repeat(digestHexLength)}`;

type RoutingScenario = {
  readonly headSha?: string;
  readonly mode: string;
  readonly publishResult: string;
};

const runRouting = ({
  headSha: selectedHead = headSha,
  mode,
  publishResult,
}: RoutingScenario) => {
  const harness = `
output=$(mktemp /tmp/wordhold-host-routing.XXXXXX)
trap 'rm -f -- "$output"' EXIT
export GITHUB_OUTPUT="$output"
set +e
(
${validation}
)
status=$?
set -e
cat "$output"
exit "$status"
`;
  const result = globalThis.Bun.spawnSync(['bash', '-c', harness], {
    env: Object.fromEntries([
      ...Object.entries(globalThis.Bun.env),
      ['HEAD_SHA', selectedHead],
      ['MODE', mode],
      ['PR_NUMBER', '36'],
      ['PUBLISHED_IMAGE', image],
      ['PUBLISH_RESULT', publishResult],
      ['REPOSITORY', 'davidvornholt/wordhold'],
    ]),
  });
  const outputs = Object.fromEntries(
    result.stdout
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('=', 2) as [string, string]),
  );
  return { exitCode: result.exitCode, outputs } as const;
};

describe('preview host routing', () => {
  it('passes the complete protected age identity through a temporary file', () => {
    const restrictiveUmask = keyResolution.indexOf('umask 077');
    const identityWrite = keyResolution.indexOf(
      `printf '%s\\n' "$SOPS_AGE_KEY" >"$identity"`,
    );

    expect(restrictiveUmask).toBeGreaterThanOrEqual(0);
    expect(identityWrite).toBeGreaterThan(restrictiveUmask);
    expect(keyResolution).toContain('unset SOPS_AGE_KEY');
    expect(keyResolution).toContain(
      'SOPS_AGE_KEY_FILE="$identity" "$sops" decrypt',
    );
    expect(cleanupStepHeader).toContain('        if: always()');
    expect(cleanup).toContain(
      'rm -f \\\n  "$RUNNER_TEMP/sops" \\\n  "$RUNNER_TEMP/wordhold-preview-age-identity" \\',
    );
  });

  it('fails key resolution with fixed diagnostics that cannot print secrets', () => {
    const diagnosticLines = keyResolution
      .split('\n')
      .filter((line) => line.includes('echo "::error::'))
      .join('\n');

    for (const [guard, diagnostic] of keyFailureContracts) {
      const guardStart = keyResolution.indexOf(guard);
      const diagnosticStart = keyResolution.indexOf(
        `echo "::error::${diagnostic}"`,
        guardStart,
      );
      const branchEnd = keyResolution.indexOf('\nfi', diagnosticStart);

      expect(guardStart).toBeGreaterThanOrEqual(0);
      expect(diagnosticStart).toBeGreaterThan(guardStart);
      expect(branchEnd).toBeGreaterThan(diagnosticStart);
      expect(keyResolution.slice(diagnosticStart, branchEnd)).toContain(
        '\n  exit 1',
      );
    }
    expect(diagnosticLines).not.toMatch(secretInterpolationPattern);
  });

  it('accepts the standard optional SSH public key comment', () => {
    expect(keyResolution).toContain(
      '[[ ! "$public_key" =~ ^ssh-ed25519\\ [A-Za-z0-9+/=]+(\\ .*)?$ ]]',
    );
  });

  it('deploys only a successfully published exact digest', () => {
    const result = runRouting({ mode: 'deploy', publishResult: 'success' });

    expect(result.exitCode).toBe(0);
    expect(result.outputs.operation).toBe('deploy');
    expect(result.outputs.reason).toBe('');
    expect(result.outputs.command).toBe(
      `deploy 36 ${image} ${image} ${headSha}`,
    );
  });

  for (const publishResult of ['failure', 'cancelled', 'timed_out']) {
    it(`removes stale state after publication ${publishResult}`, () => {
      const result = runRouting({ mode: 'deploy', publishResult });

      expect(result.exitCode).toBe(0);
      expect(result.outputs.operation).toBe('destroy');
      expect(result.outputs.reason).toBe('failed-publication');
      expect(result.outputs.command).toBe('destroy 36');
    });
  }

  it('removes an ineligible pull request without accepting a head', () => {
    const result = runRouting({
      headSha: '',
      mode: 'destroy-ineligible',
      publishResult: 'skipped',
    });

    expect(result.exitCode).toBe(0);
    expect(result.outputs.reason).toBe('ineligible');
  });

  it('removes state after a failed exact-head build', () => {
    const result = runRouting({
      mode: 'destroy-failed-build',
      publishResult: 'skipped',
    });

    expect(result.exitCode).toBe(0);
    expect(result.outputs.reason).toBe('failed-build');
  });

  for (const scenario of [
    { mode: 'deploy', publishResult: 'skipped' },
    { mode: 'destroy-ineligible', publishResult: 'success' },
    { mode: 'unknown', publishResult: 'skipped' },
  ]) {
    it(`fails closed for ${scenario.mode} with ${scenario.publishResult}`, () => {
      expect(runRouting(scenario).exitCode).not.toBe(0);
    });
  }
});
