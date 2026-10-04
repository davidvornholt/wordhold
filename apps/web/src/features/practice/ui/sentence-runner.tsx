import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type ReactNode, useState } from 'react';
import type { PrepareExamples } from '../../../shared/examples/example-model';
import { countNoun } from '../../../shared/format/count';
import type { RailOutcome } from '../../../shared/session/rail-outcome';
import { CardRail } from '../../../shared/ui/card-rail';
import type { SentenceItem, SentenceSession } from '../schemas/sentence-models';
import { SentenceCard, type SentencePrompt } from './sentence-card';
import { SentenceSummary } from './sentence-summary';
import { useExampleWarmup } from './use-example-warmup';
import { type CheckSentence, railOutcomeOf } from './use-sentence-check';

const promptOf = (item: SentenceItem): SentencePrompt | null => {
  const { example } = item;
  if (example === null || example.nativeText === null) {
    return null;
  }
  return {
    entryId: item.entryId,
    word: item.nativeText,
    sentence: example.nativeText,
    reference: example.targetText,
    hasAudio: example.hasAudio,
  };
};

const PreparingSentence = () => (
  <div
    aria-busy="true"
    className="flex min-h-48 animate-rise items-center justify-center border border-border bg-card px-6 py-8"
  >
    <p className="text-muted-foreground" role="status">
      Satz wird vorbereitet …
    </p>
  </div>
);

type SentenceRunnerProps = {
  readonly session: SentenceSession;
  readonly targetLanguage: LanguageCode;
  readonly prepareExamples: PrepareExamples;
  readonly check: CheckSentence;
  readonly backControl: ReactNode;
  readonly continueControl: ReactNode;
};

// The round's sentences are prepared one after the other while the learner
// translates, as in card practice. A word whose example could not be
// prepared, or has no German side, leaves the round once that is known.
export const SentenceRunner = ({
  session,
  targetLanguage,
  prepareExamples,
  check,
  backControl,
  continueControl,
}: SentenceRunnerProps) => {
  const warmup = useExampleWarmup(session.items, prepareExamples);
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, RailOutcome>>(
    new Map(),
  );
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const round = warmup.items.filter(
    (item) => !warmup.isSettled(item.entryId) || promptOf(item) !== null,
  );
  const activeIndex = round.findIndex((item) => !done.has(item.entryId));
  const active = round[activeIndex];
  if (active === undefined) {
    return (
      <SentenceSummary
        backControl={backControl}
        continueControl={continueControl}
        emptyReason={
          session.items.length === 0
            ? 'Die Sätze kommen aus den Beispielen der Wörter, die du hier schon gelernt hast. Lerne zuerst ein paar Wörter.'
            : 'Zu den gelernten Wörtern ließ sich gerade kein Beispielsatz vorbereiten. Versuche es später noch einmal.'
        }
        outcomes={round.flatMap((item) => outcomes.get(item.entryId) ?? [])}
      />
    );
  }
  const prompt = promptOf(active);
  return (
    <>
      <CardRail
        activeIndex={activeIndex}
        activeOutcome={outcomes.get(active.entryId) ?? null}
        description={`${done.size} von ${countNoun(
          round.length,
          'Satz',
          'Sätzen',
        )} bearbeitet`}
        label="Runde"
        ticks={round.map((item) =>
          done.has(item.entryId) ? (outcomes.get(item.entryId) ?? null) : null,
        )}
      />
      {prompt === null ? (
        <PreparingSentence />
      ) : (
        <SentenceCard
          check={check}
          deck={round.length - activeIndex - 1}
          key={prompt.entryId}
          onNext={() =>
            setDone((current) => new Set(current).add(prompt.entryId))
          }
          onOutcome={(outcome) =>
            setOutcomes((current) =>
              new Map(current).set(prompt.entryId, railOutcomeOf(outcome)),
            )
          }
          prompt={prompt}
          targetLanguage={targetLanguage}
        />
      )}
    </>
  );
};
