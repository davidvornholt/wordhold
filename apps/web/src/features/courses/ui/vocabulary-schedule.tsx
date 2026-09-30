import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { type CourseSubject, directionLabel } from '../../../shared/directions';
import type { VocabularyEntry } from '../schemas/course-units';
import { cardStatus, type VocabularyCard } from './vocabulary-schedule-status';

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

type ScheduleItemsProps = {
  readonly enabledDirections: ReadonlyArray<AnswerDirection>;
  readonly entry: VocabularyEntry;
  readonly subject: CourseSubject;
  readonly now: Date;
};

// One item of a description list per direction: when it comes up next, or
// why it does not, and how often it was not known.
export const ScheduleItems = ({
  enabledDirections,
  entry,
  subject,
  now,
}: ScheduleItemsProps) => (
  <>
    {entry.cards.map((card) => (
      <div className="grid gap-0.5" key={card.cardId}>
        <dt className="font-medium">
          {directionLabel(card.direction, subject)}
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
  </>
);
