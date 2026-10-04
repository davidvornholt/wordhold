import type { LanguageCode } from '@wordhold/db/schema/courses';
import { type ReactNode, useState } from 'react';
import type { PrepareExamples } from '../../../shared/examples/example-model';
import { countNoun } from '../../../shared/format/count';
import { CardRail } from '../../../shared/ui/card-rail';
import type { SentenceItem, SentenceSession } from '../schemas/sentence-models';
import {
  acceptSentence,
  emptySentenceRound,
  finishSentence,
  judgeSentence,
  nextSentence,
  type SentenceRound,
  sentenceRoundCounts,
} from '../services/sentence-round';
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

const railDescription = (
  round: SentenceRound,
  roundSize: number,
  repeated: boolean,
): string => {
  if (repeated) {
    return `${countNoun(round.repeat.length, 'Satz', 'Sätze')} noch einmal`;
  }
  const processed = `${round.asked.length} von ${countNoun(
    roundSize,
    'Satz',
    'Sätzen',
  )} bearbeitet`;
  return round.repeat.length > 0
    ? `${processed} · ${round.repeat.length} für die Nachrunde`
    : processed;
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
  const [round, setRound] = useState(emptySentenceRound);
  const items = warmup.items.filter(
    (item) => !warmup.isSettled(item.entryId) || promptOf(item) !== null,
  );
  const entryIds = items.map((item) => item.entryId);
  const next = nextSentence(round, entryIds);
  const active =
    next === null
      ? undefined
      : items.find((item) => item.entryId === next.entryId);
  if (next === null || active === undefined) {
    return (
      <SentenceSummary
        backControl={backControl}
        continueControl={continueControl}
        counts={sentenceRoundCounts(round)}
        emptyReason={
          session.items.length === 0
            ? 'Die Sätze kommen aus den Beispielen der Wörter, die du hier schon gelernt hast. Lerne zuerst ein paar Wörter.'
            : 'Zu den gelernten Wörtern ließ sich gerade kein Beispielsatz vorbereiten. Versuche es später noch einmal.'
        }
      />
    );
  }
  const prompt = promptOf(active);
  return (
    <>
      <CardRail
        activeIndex={entryIds.indexOf(active.entryId)}
        activeOutcome={round.judged}
        description={railDescription(round, items.length, next.repeated)}
        label={next.repeated ? 'Nachrunde' : 'Runde'}
        ticks={entryIds.map((entryId) => round.outcomes.get(entryId) ?? null)}
      />
      {prompt === null ? (
        <PreparingSentence />
      ) : (
        <SentenceCard
          check={check}
          deck={
            next.repeated
              ? round.repeat.length - 1
              : items.length - round.asked.length - 1
          }
          key={`${prompt.entryId}-${round.turn}`}
          onAccept={() =>
            setRound((current) => acceptSentence(current, prompt.entryId))
          }
          onNext={() =>
            setRound((current) => finishSentence(current, prompt.entryId))
          }
          onOutcome={(outcome) =>
            setRound((current) =>
              judgeSentence(current, railOutcomeOf(outcome)),
            )
          }
          prompt={prompt}
          repeated={next.repeated}
          targetLanguage={targetLanguage}
        />
      )}
    </>
  );
};
