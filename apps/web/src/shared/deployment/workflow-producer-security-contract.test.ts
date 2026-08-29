import { describe, expect, it } from 'bun:test';
import { readWorkflow } from './workflow-test-helpers';

const producer = await readWorkflow('publish-container.yml');
const consumer = await readWorkflow('pr-preview-deploy.yml');
const githubExpression = (expression: string): string =>
  `\${{ ${expression} }}`;

describe('preview producer trust boundary', () => {
  const pullRequestJob = producer.slice(
    producer.indexOf('  container-smoke:'),
    producer.indexOf('  gate:'),
  );
  const pullRequestJobHeader = pullRequestJob.split('    runs-on:', 1)[0] ?? '';

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

  it('starts the expensive build only for an eligible preview request', () => {
    expect(producer).toContain('      - edited');
    expect(pullRequestJobHeader).toContain(
      "github.event.pull_request.state == 'open'",
    );
    expect(pullRequestJobHeader).toContain('!github.event.pull_request.draft');
    expect(pullRequestJobHeader).toContain(
      'github.event.pull_request.base.repo.full_name == github.repository',
    );
    expect(pullRequestJobHeader).toContain(
      "github.event.pull_request.base.ref == 'main'",
    );
    expect(pullRequestJobHeader).toContain(
      'github.event.pull_request.head.repo.full_name == github.repository',
    );
    expect(pullRequestJobHeader).toContain(
      "contains(github.event.pull_request.labels.*.name, 'pr-preview')",
    );
    expect(pullRequestJobHeader).toContain(
      "github.event.action != 'labeled' || github.event.label.name == 'pr-preview'",
    );
    expect(pullRequestJobHeader).toContain(
      "github.event.action != 'edited' || github.event.changes.base != null",
    );
    expect(pullRequestJob).not.toContain(
      'Select eligibility from the pull request event',
    );
  });
});
