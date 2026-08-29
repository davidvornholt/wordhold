import { describe, expect, it } from 'bun:test';
import { extractRunScript, readWorkflow } from './workflow-test-helpers';

const workflow = await readWorkflow('pr-preview-deploy.yml');
const reconciliation = extractRunScript(
  workflow,
  'Reconcile the pull request preview comment',
);
const headShaLength = 40;
const marker = '<!-- wordhold-pr-preview -->';

type ReconciliationScenario = {
  readonly comments?: ReadonlyArray<Record<string, unknown>>;
  readonly operation: 'deploy' | 'destroy';
};

const runReconciliation = ({
  comments = [],
  operation,
}: ReconciliationScenario) => {
  const harness = `
set -u
test_root=$(mktemp -d /tmp/wordhold-preview-comment-test.XXXXXX)
trap 'rm -rf -- "$test_root"' EXIT
export COMMENT_GH_LOG="$test_root/gh.log"
: >"$COMMENT_GH_LOG"
gh() {
  test "$1" = api
  if [ "$2" = --paginate ]; then
    printf '%s\n' "$COMMENT_PAGES"
    return
  fi
  test "$2" = --method
  printf '%s %s\n' "$3" "$4" >>"$COMMENT_GH_LOG"
}
set +e
(
${reconciliation}
)
status=$?
set -e
printf '\n__WORDHOLD_CALLS__\n'
cat "$COMMENT_GH_LOG"
exit "$status"
`;
  const result = globalThis.Bun.spawnSync(['bash', '-c', harness], {
    env: Object.fromEntries([
      ...Object.entries(globalThis.Bun.env),
      ['COMMENT_PAGES', JSON.stringify(comments)],
      ['GH_TOKEN', 'test-token'],
      ['HEAD_SHA', '1'.repeat(headShaLength)],
      ['HOST_IN_SCOPE', 'true'],
      ['HOST_OUTCOME', 'success'],
      ['OPERATION', operation],
      ['PR_NUMBER', '35'],
      ['REPOSITORY', 'davidvornholt/wordhold'],
    ]),
  });
  const stdout = result.stdout.toString();
  const calls = stdout.split('__WORDHOLD_CALLS__\n', 2)[1]?.trim() ?? '';

  return { calls, exitCode: result.exitCode, stdout } as const;
};

describe('preview status comment reconciliation', () => {
  it('creates a status comment when deployment starts preview activity', () => {
    const result = runReconciliation({ operation: 'deploy' });

    expect(result.exitCode).toBe(0);
    expect(result.calls).toBe(
      'POST repos/davidvornholt/wordhold/issues/35/comments',
    );
  });

  it('keeps cleanup silent when the pull request has no preview status', () => {
    const result = runReconciliation({ operation: 'destroy' });

    expect(result.exitCode).toBe(0);
    expect(result.calls).toBe('');
    expect(result.stdout).toContain(
      'Cleanup found no preview status to update',
    );
  });

  it('updates an existing preview status after cleanup', () => {
    const result = runReconciliation({
      comments: [
        {
          body: `${marker}\n\nState: deployed and healthy`,
          id: 123,
          user: { login: 'github-actions[bot]' },
        },
      ],
      operation: 'destroy',
    });

    expect(result.exitCode).toBe(0);
    expect(result.calls).toBe(
      'PATCH repos/davidvornholt/wordhold/issues/comments/123',
    );
  });
});
