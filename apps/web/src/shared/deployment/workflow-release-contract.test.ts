import { describe, expect, it } from 'bun:test';
import { readWorkflow } from './workflow-test-helpers';

const producer = await readWorkflow('publish-container.yml');
const rollBack = await readWorkflow('roll-back.yml');
const githubExpression = (expression: string): string =>
  `\${{ ${expression} }}`;
const releaseQueue = [
  '    concurrency:',
  '      group: app-release-wordhold',
  '      cancel-in-progress: false',
  '      queue: max',
].join('\n');
const releasePermissions = [
  '    permissions:',
  '      contents: read',
  '      id-token: write',
  '      packages: write',
].join('\n');

describe('production release trust boundary', () => {
  const buildJob = producer.slice(
    producer.indexOf('  build:'),
    producer.indexOf('  release:'),
  );
  const releaseJob = producer.slice(producer.indexOf('  release:'));

  it('builds only trusted main pushes and binds the image to the commit', () => {
    expect(buildJob).toContain("    if: github.event_name == 'push'");
    expect(buildJob).not.toContain('    needs:');
    expect(buildJob).toContain('          provenance: false');
    expect(buildJob).toContain(
      `org.opencontainers.image.revision=${githubExpression('github.sha')}`,
    );
    expect(buildJob).not.toContain('id-token');
  });

  it('releases only the built digest of a commit the gate passed', () => {
    expect(releaseJob).toContain('    needs:\n      - gate\n      - build\n');
    expect(releaseJob).toContain(
      '    if: needs.gate.outputs.gated-sha == github.sha\n',
    );
    expect(releaseJob).toContain(
      `          images: wordhold@${githubExpression('needs.build.outputs.digest')}`,
    );
    expect(releaseJob).toContain('        uses: ./.github/actions/app-release');
    expect(releaseJob).toContain(`ref: ${githubExpression('github.sha')}`);
    expect(releaseJob).toContain('persist-credentials: false');
  });

  it('grants the OIDC token only to the release job', () => {
    expect(releaseJob).toContain(releasePermissions);
    expect(producer.split('id-token: write')).toHaveLength(2);
    expect(producer).toContain('\npermissions: {}\n');
  });

  it('moves main only after prod-1 reports the released digest', () => {
    const moveMain = releaseJob.indexOf(
      'name: Move main to the released image',
    );

    expect(moveMain).toBeGreaterThan(
      releaseJob.indexOf('name: Release the exact image to prod-1'),
    );
    expect(releaseJob.slice(moveMain)).toContain(
      "steps.release.outputs.result == 'released' || steps.release.outputs.result == 'unchanged'",
    );
  });

  it('serializes releases and rollbacks in one queue', () => {
    expect(releaseJob).toContain(releaseQueue);
    expect(rollBack).toContain(releaseQueue);
  });

  it('rolls back only from a manual run on main', () => {
    expect(rollBack).toContain('\non: workflow_dispatch\n');
    expect(rollBack).toContain('\npermissions: {}\n');
    expect(rollBack).toContain(releasePermissions);
    expect(rollBack).toContain('"$GITHUB_REF" != refs/heads/main');
    expect(rollBack).toContain('          command: rollback');
    expect(rollBack).toContain('persist-credentials: false');
    expect(rollBack.indexOf('"$GITHUB_REF" != refs/heads/main')).toBeLessThan(
      rollBack.indexOf('        uses: ./.github/actions/app-release'),
    );
  });
});
