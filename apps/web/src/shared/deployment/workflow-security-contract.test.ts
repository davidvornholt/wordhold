import { describe, expect, it } from 'bun:test';
import { extractRunScript, readWorkflow } from './workflow-test-helpers';

const producer = await readWorkflow('publish-container.yml');
const consumer = await readWorkflow('pr-preview-deploy.yml');
const hostCommand = await readWorkflow('pr-preview-host-command.yml');
const hostOwnedMaximumMinutes = 180;
const outerCleanupMarginMinutes = 20;
const sshTimeoutPattern = /timeout (?<minutes>\d+)m ssh/u;
const jobTimeoutPattern = / {4}timeout-minutes: (?<minutes>\d+)/u;
const githubExpression = (expression: string): string =>
  `\${{ ${expression} }}`;

describe('preview producer trust boundary', () => {
  const pullRequestJob = producer.slice(
    producer.indexOf('  container-smoke:'),
    producer.indexOf('  gate:'),
  );

  it('grants untrusted pull request code only repository read access', () => {
    expect(pullRequestJob).toContain('    permissions:\n      contents: read');
    expect(pullRequestJob).not.toContain('      actions: read');
    expect(pullRequestJob).not.toContain('      pull-requests: read');
    expect(pullRequestJob).not.toContain('GH_TOKEN:');
    expect(pullRequestJob).not.toContain('gh api');
  });

  it('checks out and gates the exact pull request head before packaging', () => {
    const checkout = pullRequestJob.indexOf(
      `ref: ${githubExpression('github.event.pull_request.head.sha')}`,
    );
    const assertion = pullRequestJob.indexOf(
      'test "$(git rev-parse HEAD)" = "$HEAD_SHA"',
    );
    const gate = pullRequestJob.indexOf(
      'name: Run the full exact-head repository gate',
    );
    const packageArtifact = pullRequestJob.indexOf(
      'name: Package the eligible exact-head preview artifact',
    );

    expect(checkout).toBeGreaterThan(0);
    expect(assertion).toBeGreaterThan(checkout);
    expect(gate).toBeGreaterThan(assertion);
    expect(packageArtifact).toBeGreaterThan(gate);
    expect(pullRequestJob).toContain('bun run check');
  });

  it('publishes the exact host-owned preview label', () => {
    expect(pullRequestJob).toContain('io.personal-infra.wordhold-preview=true');
    expect(producer).not.toContain('online.vornholt.wordhold.preview');
    expect(consumer).toContain('io.personal-infra.wordhold-preview');
    expect(consumer).not.toContain('online.vornholt.wordhold.preview');
  });

  it('runs base-branch edits only when the payload reports a base change', () => {
    expect(producer).toContain('      - edited');
    expect(pullRequestJob).toContain(
      "github.event.action != 'edited' || github.event.changes.base != null",
    );
    expect(pullRequestJob).toContain(
      'Select eligibility from the pull request event',
    );
  });
});

describe('trusted preview consumer boundary', () => {
  const selector = extractRunScript(
    consumer,
    'Select an exact current preview operation',
  );
  const artifact = extractRunScript(
    consumer,
    'Fetch and validate the exact gated artifact',
  );

  it('binds runs to the base-owned producer identity', () => {
    expect(selector).toContain('test "$EVENT_WORKFLOW_ID" = 343592175');
    expect(selector).toContain('test "$EVENT_NAME" = \'Publish container\'');
    expect(selector).toContain(
      'test "$EVENT_PATH" = .github/workflows/publish-container.yml',
    );
    expect(selector).toContain(
      'test "$(jq -er .head_sha <<<"$run")" = "$EVENT_HEAD_SHA"',
    );
  });

  it('checks trusted workflow blobs only on the deploy path', () => {
    const deployOnlyGate = selector.indexOf('if [ "$mode" = deploy ]; then');
    const blobGate = selector.indexOf(
      'if ! trusted_workflows_match_main; then',
      deployOnlyGate,
    );
    const output = selector.indexOf('echo "mode=$mode"');

    expect(deployOnlyGate).toBeGreaterThan(0);
    expect(blobGate).toBeGreaterThan(deployOnlyGate);
    expect(output).toBeGreaterThan(blobGate);
  });

  it('discovers Standards independently and binds the exact producer gate step', () => {
    expect(artifact).toContain(
      'actions/runs/$RUN_ID/attempts/$RUN_ATTEMPT/jobs?per_page=100',
    );
    expect(artifact).toContain(
      'select(.name == "Run the full exact-head repository gate")',
    );
    expect(artifact).toContain('actions/workflows/standards.yml');
    expect(artifact).toContain('select(.name == "check")');
    expect(artifact).not.toContain('.standards.runId');
  });

  it('rejects oversized, malformed, or structurally unexpected artifacts', () => {
    expect(artifact).toContain(
      '.size_in_bytes | select(. > 0 and . <= 1610612736)',
    );
    expect(artifact).toContain('test "$metadata_size" -le 65536');
    expect(artifact).toContain('test "$archive_size" -le 1610612736');
    expect(artifact).toContain(
      'test "$entries" = $\'metadata.json\\nwordhold-image.tar.gz\'',
    );
    expect(artifact).toContain('timeout 5m gzip --test');
    expect(artifact).toContain('ulimit -f 2097152');
    expect(artifact).toContain('test "$image_tar_size" -le 2147483648');
    expect(artifact).toContain(
      'cmp "$RUNNER_TEMP/expected-metadata.json" "$metadata"',
    );
  });
});

describe('preview host authorization and secret boundary', () => {
  it('uses only the dedicated main-only environment secret contract', () => {
    expect(hostCommand).toContain('      name: pr-preview');
    expect(hostCommand).toContain(
      `SOPS_AGE_KEY: ${githubExpression('secrets.SOPS_AGE_KEY')}`,
    );
    expect(hostCommand).toContain('secrets/pr-preview.yaml?ref=$main_sha');
    expect(hostCommand).not.toContain('secrets: inherit');
    expect(hostCommand).not.toContain('secrets/ci.yaml');
  });

  it('allows only the exact forced-command shapes after a current PR check', () => {
    expect(hostCommand).toContain("printf 'command=deploy %s %s %s %s\\n'");
    expect(hostCommand).toContain("printf 'command=destroy %s\\n'");
    expect(hostCommand).toContain(
      'pr=$(gh api "repos/$REPOSITORY/pulls/$PR_NUMBER")',
    );
    expect(hostCommand).toContain('test "$current_head" = "$HEAD_SHA"');
    expect(hostCommand).toContain('StrictHostKeyChecking=yes');
  });

  it('keeps outer cancellation above the host-owned maximum', () => {
    const sshMinutes = Number(
      sshTimeoutPattern.exec(hostCommand)?.groups?.minutes ?? '0',
    );
    const jobMinutes = Number(
      jobTimeoutPattern.exec(hostCommand)?.groups?.minutes ?? '0',
    );

    expect(sshMinutes).toBeGreaterThan(hostOwnedMaximumMinutes);
    expect(sshMinutes - hostOwnedMaximumMinutes).toBeGreaterThanOrEqual(
      outerCleanupMarginMinutes,
    );
    expect(jobMinutes).toBeGreaterThan(sshMinutes);
  });
});
