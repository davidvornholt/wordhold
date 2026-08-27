import {
  apiRecord,
  eligiblePullRequest,
  headSha,
  producerRun,
  producerRunId,
} from './preview-selection-fixtures';

const repositoryRoot = new URL('../../../../../', import.meta.url);

export const readWorkflow = (name: string): Promise<string> =>
  globalThis.Bun.file(
    new URL(`.github/workflows/${name}`, repositoryRoot),
  ).text();

export const extractRunScript = (
  workflow: string,
  stepName: string,
): string => {
  const stepStart = workflow.indexOf(`      - name: ${stepName}\n`);
  if (stepStart === -1) {
    throw new Error(`Workflow step not found: ${stepName}`);
  }
  const runStart = workflow.indexOf('        run: |\n', stepStart);
  if (runStart === -1) {
    throw new Error(`Workflow step has no run script: ${stepName}`);
  }
  const lines = workflow
    .slice(runStart + '        run: |\n'.length)
    .split('\n');
  const scriptLines: Array<string> = [];
  for (const line of lines) {
    if (!(line.startsWith('          ') || line.length === 0)) {
      break;
    }
    scriptLines.push(line.slice(10));
  }
  return scriptLines.join('\n');
};

type SelectionScenario = {
  readonly action?: string;
  readonly associated?: ReadonlyArray<Record<string, unknown>>;
  readonly baseFrom?: string;
  readonly candidates?: ReadonlyArray<Record<string, unknown>>;
  readonly candidatesResponse?: Record<string, unknown>;
  readonly candidateJobConclusions?: Readonly<Record<number, string>>;
  readonly conclusion?: string;
  readonly directAssociations?: ReadonlyArray<{ readonly number: number }>;
  readonly pullRequest?: Record<string, unknown>;
  readonly producerJobConclusion?: string;
  readonly trigger?: 'pull_request_target' | 'workflow_run';
};

type SelectionResult = {
  readonly exitCode: number;
  readonly log: string;
  readonly outputs: Readonly<Record<string, string>>;
};

const json = (value: unknown): string => JSON.stringify(value);

const selectionEnvironment = (
  entries: ReadonlyArray<readonly [string, string]>,
): Record<string, string | undefined> => ({
  ...globalThis.Bun.env,
  ...Object.fromEntries(entries),
});

export const runSelection = (
  scenario: SelectionScenario = {},
): SelectionResult => {
  const harness = `
set -u
test_root=$(mktemp -d /tmp/wordhold-preview-test.XXXXXX)
trap 'rm -rf -- "$test_root"' EXIT
export GITHUB_OUTPUT="$test_root/outputs"
export SELECT_GH_LOG="$test_root/gh.log"
: >"$GITHUB_OUTPUT"
: >"$SELECT_GH_LOG"
gh() {
test "$1" = api
endpoint="\${@: -1}"
printf '%s\n' "$endpoint" >>"$SELECT_GH_LOG"
case "$endpoint" in
  */actions/runs/100) printf '%s' "$SELECT_RUN" ;;
  */actions/runs/*/attempts/*/jobs*)
    if [[ "$endpoint" =~ /actions/runs/([0-9]+)/attempts/ ]]; then
      jq -cer --arg id "\${BASH_REMATCH[1]}" '.[$id]' <<<"$SELECT_JOBS_BY_RUN"
    else
      exit 97
    fi
    ;;
  */actions/workflows/343592175/runs*) printf '%s' "$SELECT_CANDIDATES" ;;
  */commits/*/pulls*) printf '%s' "$SELECT_ASSOCIATED" ;;
  */pulls/35) printf '%s' "$SELECT_PR" ;;
  */git/ref/heads/main) printf '%s' '{"object":{"sha":"2222222222222222222222222222222222222222"}}' ;;
  */contents/.github/workflows/publish-container.yml*) printf '%s' '{"type":"file","path":".github/workflows/publish-container.yml","sha":"producer-blob"}' ;;
  */contents/.github/workflows/standards.yml*) printf '%s' '{"type":"file","path":".github/workflows/standards.yml","sha":"standards-blob"}' ;;
  *) printf 'unexpected endpoint: %s\n' "$endpoint" >&2; exit 97 ;;
esac
}
set +e
(
${selectionScript}
)
status=$?
set -e
printf '\n__WORDHOLD_OUTPUTS__\n'
cat "$GITHUB_OUTPUT"
printf '__WORDHOLD_LOG__\n'
cat "$SELECT_GH_LOG"
printf '__WORDHOLD_END__\n'
exit "$status"
`;

  const directAssociations = scenario.directAssociations ?? [{ number: 35 }];
  const run = {
    ...producerRun(directAssociations),
    conclusion: scenario.conclusion ?? 'success',
  };
  const candidates = scenario.candidates ?? [run];
  const candidateJobConclusions = {
    [producerRunId]: scenario.producerJobConclusion ?? 'success',
    ...scenario.candidateJobConclusions,
  };
  const jobsByRun = Object.fromEntries(
    Object.entries(candidateJobConclusions).map(([runId, conclusion]) => [
      runId,
      apiRecord([
        ['total_count', 1],
        [
          'jobs',
          [
            apiRecord([
              ['name', 'container-smoke'],
              ['status', 'completed'],
              ['conclusion', conclusion],
              ['run_id', Number(runId)],
              ['run_attempt', 1],
              ['head_sha', headSha],
              [
                'steps',
                [
                  {
                    name: 'Run the full exact-head repository gate',
                    status: 'completed',
                    conclusion: 'success',
                  },
                ],
              ],
            ]),
          ],
        ],
      ]),
    ]),
  );
  const result = globalThis.Bun.spawnSync(['bash', '-c', harness], {
    cwd: repositoryRoot.pathname,
    env: selectionEnvironment([
      ['EVENT_ACTION', scenario.action ?? ''],
      ['EVENT_BASE_FROM', scenario.baseFrom ?? ''],
      ['EVENT_CONCLUSION', scenario.conclusion ?? 'success'],
      ['EVENT_HEAD_SHA', headSha],
      ['EVENT_LABEL', scenario.action === 'unlabeled' ? 'pr-preview' : ''],
      ['EVENT_NAME', 'Publish container'],
      ['EVENT_PATH', '.github/workflows/publish-container.yml'],
      ['EVENT_PR_NUMBER', '35'],
      ['EVENT_RUN_ID', '100'],
      ['EVENT_TYPE', 'pull_request'],
      ['EVENT_WORKFLOW_ID', '343592175'],
      ['GH_TOKEN', 'test-token'],
      ['REPOSITORY', 'davidvornholt/wordhold'],
      ['SELECT_ASSOCIATED', json(scenario.associated ?? [])],
      [
        'SELECT_CANDIDATES',
        json(
          scenario.candidatesResponse ??
            apiRecord([
              ['total_count', candidates.length],
              ['workflow_runs', candidates],
            ]),
        ),
      ],
      ['SELECT_JOBS_BY_RUN', json(jobsByRun)],
      ['SELECT_PR', json(scenario.pullRequest ?? eligiblePullRequest())],
      ['SELECT_RUN', json(run)],
      ['TRIGGER', scenario.trigger ?? 'workflow_run'],
    ]),
  });
  const stdout = result.stdout.toString();
  const outputText = stdout
    .split('__WORDHOLD_OUTPUTS__\n', 2)[1]
    ?.split('__WORDHOLD_LOG__\n', 1)[0];
  const log = stdout
    .split('__WORDHOLD_LOG__\n', 2)[1]
    ?.split('__WORDHOLD_END__\n', 1)[0];
  if (outputText === undefined || log === undefined) {
    throw new Error(`Selection harness produced malformed output: ${stdout}`);
  }
  const outputs = Object.fromEntries(
    outputText
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split('=', 2) as [string, string]),
  );
  return { exitCode: result.exitCode, log, outputs };
};

const deployWorkflow = await readWorkflow('pr-preview-deploy.yml');
const selectStepName = 'Select an exact current preview operation';
const selectionScript = extractRunScript(deployWorkflow, selectStepName);
