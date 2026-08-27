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
    'docker image tag wordhold:pull-request "$IMAGE:$tag"',
  );
  const resolutionEnd = publish.indexOf('docker logout ghcr.io');
  const resolution = publish.slice(resolutionStart, resolutionEnd);
  const digest = `sha256:${'a'.repeat(digestHexLength)}`;
  const harness = `
set -euo pipefail
IMAGE=ghcr.io/davidvornholt/wordhold
PR_NUMBER=35
HEAD_SHA=${'1'.repeat(headShaLength)}
RUN_ID=100
RUN_ATTEMPT=1
tag=fixture
docker() {
  case "$*" in
    'image tag '*) ;;
    'image push '*) printf '%s\n' 'layer: Pushed' 'latest: digest: ${digest} size: 1985' ;;
    'buildx imagetools inspect '*) printf '%s\n' 'Name: fixture' 'Digest: ${digest}'; return ${inspectExitCode} ;;
    *) return 97 ;;
  esac
}
${resolution}
printf '%s' "$digest"
`;

  return {
    resolution,
    result: globalThis.Bun.spawnSync(['bash', '-c', harness]),
  } as const;
};

describe('preview digest resolution', () => {
  it('resolves one digest from the pushed tag instead of parsing push output', () => {
    const { resolution, result } = runDigestResolution(0);
    const digest = `sha256:${'a'.repeat(digestHexLength)}`;

    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().endsWith(digest)).toBe(true);
    expect(resolution).not.toContain('push_output=');
  });

  it('rejects a valid-looking digest when tag inspection fails', () => {
    const { result } = runDigestResolution(failedInspectExitCode);

    expect(result.exitCode).not.toBe(0);
  });
});
