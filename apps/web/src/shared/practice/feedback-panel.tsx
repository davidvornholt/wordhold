import type { submitAnswer } from './submit-fn';

export type SubmitResult = Awaited<ReturnType<typeof submitAnswer>>;

type FeedbackPanelProps = {
  readonly result: SubmitResult;
  readonly audioUrl: string | null;
  readonly onNext: () => void;
};

export const FeedbackPanel = ({
  result,
  audioUrl,
  onNext,
}: FeedbackPanelProps) => (
  <div
    className={`flex flex-col gap-3 rounded-lg border p-4 ${
      result.graded && result.correct
        ? 'border-green-300 bg-green-50'
        : 'border-red-300 bg-red-50'
    }`}
  >
    {result.graded ? (
      <p className="font-medium">
        {result.correct ? 'Richtig!' : 'Leider falsch.'}
      </p>
    ) : (
      <p className="font-medium">{result.message}</p>
    )}
    <p className="text-sm">
      Erwartet:{' '}
      <span className="font-medium">{result.expectedAnswers.join(' / ')}</span>
    </p>
    {result.graded && result.explanation !== null ? (
      <p className="text-sm">{result.explanation}</p>
    ) : null}
    {result.graded && result.acceptedAsAlternative ? (
      <p className="text-green-800 text-sm">
        Deine Antwort wurde als gültige Alternative gespeichert.
      </p>
    ) : null}
    <div className="flex items-center gap-3">
      {audioUrl === null ? null : (
        <button
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm"
          onClick={async () => {
            await new Audio(audioUrl).play().catch(() => undefined);
          }}
          type="button"
        >
          Aussprache anhören
        </button>
      )}
      <button
        className="rounded bg-neutral-900 px-4 py-1.5 text-sm text-white"
        onClick={onNext}
        type="button"
      >
        Weiter
      </button>
    </div>
  </div>
);
