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
