import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import {
  earliestDate,
  formatLearningDate,
} from '../../../shared/dates/learning-date';
import { directionLabel } from '../../../shared/directions';
import { germanLabels } from '../../../shared/languages';
import type { VocabularyEntry } from '../schemas/course-units';

type VocabularyCard = VocabularyEntry['cards'][number];

const isPracticed = (card: VocabularyCard): boolean =>
  card.introducedAt !== null && card.state !== 'new';

const scheduleSummary = (
  entry: VocabularyEntry,
  enabledDirections: ReadonlyArray<AnswerDirection>,
  now: Date,
): string => {
  const activeCards = entry.cards.filter((card) =>
    enabledDirections.includes(card.direction),
  );
  const introduced = activeCards.filter((card) => card.introducedAt !== null);
  const practiced = activeCards.filter(isPracticed);
  if (introduced.length === 0) {
    return 'Noch nicht kennengelernt';
  }
  if (practiced.length < activeCards.length) {
    if (activeCards.length === 1) {
      return 'Bereit für die erste Übung';
    }
    return practiced.length === 0
      ? `${introduced.length} von ${activeCards.length} Richtungen bereit`
      : `${practiced.length} von ${activeCards.length} Richtungen geübt`;
  }
  const due = practiced.filter(
    (card) => card.dueAt !== null && card.dueAt <= now,
  );
  const nextDueAt = earliestDate(practiced.map((card) => card.dueAt));
  if (due.length > 0) {
    if (activeCards.length === 1 && nextDueAt !== null) {
      return formatLearningDate(nextDueAt, now);
    }
    if (due.length === activeCards.length) {
      return 'Beide Richtungen fällig';
    }
    return `${due.length} von ${activeCards.length} Richtungen fällig`;
  }
  return nextDueAt === null
    ? 'Noch kein weiterer Termin'
    : `Nächste Wiederholung ${formatLearningDate(nextDueAt, now).toLocaleLowerCase('de-DE')}`;
};

const cardStatus = (card: VocabularyCard, now: Date): string => {
  if (card.introducedAt === null) {
    return 'Noch nicht kennengelernt';
  }
  if (card.state === 'new') {
    return 'Bereit für die erste Übung';
  }
  if (card.dueAt === null) {
    return 'Noch kein weiterer Termin';
  }
  return card.dueAt <= now
    ? formatLearningDate(card.dueAt, now)
    : `Nächste Wiederholung ${formatLearningDate(card.dueAt, now).toLocaleLowerCase('de-DE')}`;
};

const CardSchedule = ({
  card,
  enabled,
  now,
}: {
  readonly card: VocabularyCard;
  readonly enabled: boolean;
  readonly now: Date;
}) => {
  if (!enabled) {
    return 'Nicht im Lernplan';
  }
  const status = cardStatus(card, now);
  return card.dueAt === null ? (
    status
  ) : (
    <time dateTime={card.dueAt.toISOString()}>{status}</time>
  );
};

type VocabularyScheduleProps = {
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly entry: VocabularyEntry;
  readonly targetLanguage: LanguageCode;
  readonly now?: Date;
};

export const VocabularySchedule = ({
  enabledDirections,
  entry,
  targetLanguage,
  now = new Date(),
}: VocabularyScheduleProps) => {
  const targetLabel = germanLabels[targetLanguage];
  return (
    <details className="group text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="group-open:rotate-90">
          ▸
        </span>
        {scheduleSummary(entry, enabledDirections, now)}
      </summary>
      <dl className="mt-3 grid gap-3 border-border border-l pl-3">
        {entry.cards.map((card) => (
          <div className="grid gap-0.5" key={card.cardId}>
            <dt className="font-medium">
              {directionLabel(card.direction, targetLabel)}
            </dt>
            <dd className="text-muted-foreground">
              <CardSchedule
                card={card}
                enabled={enabledDirections.includes(card.direction)}
                now={now}
              />
              {card.failures > 0 ? ` · ${card.failures}× nicht gewusst` : ''}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
};
