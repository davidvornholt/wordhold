import { describe, expect, it } from 'bun:test';
import { apiRecord, eligiblePullRequest } from './preview-selection-fixtures';
import { runSelection } from './workflow-test-helpers';

describe('trusted preview lifecycle selection', () => {
  it.each([
    ['closed', eligiblePullRequest({ state: 'closed' })],
    ['converted_to_draft', eligiblePullRequest({ draft: true })],
    ['unlabeled', eligiblePullRequest({ labels: [] })],
  ])(
    'tears down a main-lane preview when the pull request is %s',
    (action, pullRequest) => {
      const result = runSelection({
        action,
        pullRequest,
        trigger: 'pull_request_target',
      });

      expect(result.exitCode).toBe(0);
      expect(result.outputs.mode).toBe('destroy-ineligible');
      expect(result.outputs['pull-request-number']).toBe('35');
    },
  );

  it('tears down a preview retargeted away from main', () => {
    const result = runSelection({
      action: 'edited',
      baseFrom: 'main',
      pullRequest: eligiblePullRequest({
        base: apiRecord([
          ['repo', apiRecord([['full_name', 'davidvornholt/wordhold']])],
          ['ref', 'stacked'],
        ]),
      }),
      trigger: 'pull_request_target',
    });

    expect(result.exitCode).toBe(0);
    expect(result.outputs.mode).toBe('destroy-ineligible');
  });

  it('retries teardown after a retarget cleanup failed', () => {
    const outsideMain = eligiblePullRequest({
      base: apiRecord([
        ['repo', apiRecord([['full_name', 'davidvornholt/wordhold']])],
        ['ref', 'stacked'],
      ]),
    });
    const retarget = runSelection({
      action: 'edited',
      baseFrom: 'main',
      pullRequest: outsideMain,
      trigger: 'pull_request_target',
    });
    const laterClose = runSelection({
      action: 'closed',
      pullRequest: { ...outsideMain, state: 'closed' },
      trigger: 'pull_request_target',
    });

    expect(retarget.outputs.mode).toBe('destroy-ineligible');
    expect(laterClose.exitCode).toBe(0);
    expect(laterClose.outputs.mode).toBe('destroy-ineligible');
  });

  it('leaves a retarget into main for the producer to build', () => {
    const result = runSelection({
      action: 'edited',
      baseFrom: 'stacked',
      trigger: 'pull_request_target',
    });

    expect(result.exitCode).toBe(0);
    expect(result.outputs.mode).toBe('none');
    expect(result.log).toBe('');
  });

  it('ignores edits that do not change the base branch', () => {
    const result = runSelection({
      action: 'edited',
      trigger: 'pull_request_target',
    });

    expect(result.exitCode).toBe(0);
    expect(result.outputs.mode).toBe('none');
    expect(result.log).toBe('');
  });

  it('rechecks current state before teardown', () => {
    const result = runSelection({
      action: 'converted_to_draft',
      pullRequest: eligiblePullRequest(),
      trigger: 'pull_request_target',
    });

    expect(result.exitCode).toBe(0);
    expect(result.outputs.mode).toBe('none');
  });
});
