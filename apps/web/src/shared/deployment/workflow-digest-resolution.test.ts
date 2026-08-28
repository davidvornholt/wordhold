import { describe, expect, it } from 'bun:test';
import { extractRunScript, readWorkflow } from './workflow-test-helpers';

const consumer = await readWorkflow('pr-preview-deploy.yml');
const digestHexLength = 64;
const failedInspectExitCode = 42;
const headShaLength = 40;

const runDigestResolution = (inspectExitCode: number) => {
  const publish = extractRunScript(
    consumer,
    'Publish and prove the exact public digest',
  );
  const resolutionStart = publish.indexOf(
    'tag="pr-$PR_NUMBER-$HEAD_SHA-run-$RUN_ID-attempt-$RUN_ATTEMPT"',
  );
  const resolutionEnd = publish.indexOf('docker logout ghcr.io');
  const resolution = publish.slice(resolutionStart, resolutionEnd);
  const expectedTag = `ghcr.io/davidvornholt/wordhold:pr-35-${'1'.repeat(headShaLength)}-run-100-attempt-1`;
  const pushDigest = `sha256:${'a'.repeat(digestHexLength)}`;
  const inspectDigest = `sha256:${'b'.repeat(digestHexLength)}`;
  const harness = `
set -euo pipefail
IMAGE=ghcr.io/davidvornholt/wordhold
PR_NUMBER=35
HEAD_SHA=${'1'.repeat(headShaLength)}
RUN_ID=100
RUN_ATTEMPT=1
docker() {
  case "$*" in
    'image tag wordhold:pull-request ${expectedTag}') ;;
    'image push ${expectedTag}') printf '%s\n' 'layer: Pushed' 'latest: digest: ${pushDigest} size: 1985' ;;
    'buildx imagetools inspect ${expectedTag}') printf '%s\n' 'Name: fixture' 'Digest: ${inspectDigest}'; return ${inspectExitCode} ;;
    *) return 97 ;;
  esac
}
${resolution}
printf '\nresolved=%s\n' "$digest"
`;

  return {
    inspectDigest,
    resolution,
    result: globalThis.Bun.spawnSync(['bash', '-c', harness]),
  } as const;
};

describe('preview digest resolution', () => {
  it('resolves one digest from the pushed tag instead of parsing push output', () => {
    const { inspectDigest, resolution, result } = runDigestResolution(0);
    const resolvedDigest = result.stdout.toString().trim().split('\n').at(-1);

    expect(result.exitCode).toBe(0);
    expect(resolvedDigest).toBe(`resolved=${inspectDigest}`);
    expect(resolution).not.toContain('push_output=');
  });

  it('rejects a valid-looking digest when tag inspection fails', () => {
    const { result } = runDigestResolution(failedInspectExitCode);

    expect(result.exitCode).not.toBe(0);
  });
});
