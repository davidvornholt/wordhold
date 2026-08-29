import type { LanguageCode } from '@wordhold/db/schema/courses';
import { formatLearningDate } from '../../../shared/dates/learning-date';
import { directionLabel } from '../../../shared/directions';
import { germanLabels } from '../../../shared/languages';
import type { VocabularyEntry } from '../schemas/course-units';

const cardStatus = (
  card: VocabularyEntry['cards'][number],
  now: Date,
): string => {
  if (card.introducedAt === null) {
    return 'Noch kennenlernen';
  }
  if (card.state === 'new') {
    return 'Erste Abfrage offen';
  }
  return card.dueAt === null
    ? 'Noch kein Termin'
    : formatLearningDate(card.dueAt, now);
};

type VocabularyScheduleProps = {
  readonly entry: VocabularyEntry;
  readonly targetLanguage: LanguageCode;
  readonly now?: Date;
};

export const VocabularySchedule = ({
  entry,
  targetLanguage,
  now = new Date(),
}: VocabularyScheduleProps) => {
  const targetLabel = germanLabels[targetLanguage];
  const [actionable] = entry.cards
    .filter((card) => card.introducedAt !== null)
    .sort((left, right) => {
      if (left.state === 'new') {
        return -1;
      }
      if (right.state === 'new') {
        return 1;
      }
      return (
        (left.dueAt?.getTime() ?? Number.POSITIVE_INFINITY) -
        (right.dueAt?.getTime() ?? Number.POSITIVE_INFINITY)
      );
    });

  if (actionable === undefined) {
    return <p className="text-muted-foreground text-sm">Noch kennenlernen</p>;
  }

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline">
        {cardStatus(actionable, now)}
      </summary>
      <dl className="mt-3 grid gap-2 border-border border-l pl-3">
        {entry.cards.map((card) => (
          <div className="grid gap-0.5" key={card.cardId}>
            <dt className="font-medium">
              {directionLabel(card.direction, targetLabel)}
            </dt>
            <dd className="text-muted-foreground">
              {card.dueAt === null ? (
                cardStatus(card, now)
              ) : (
                <time dateTime={card.dueAt.toISOString()}>
                  {cardStatus(card, now)}
                </time>
              )}
              {card.failures > 0 ? ` · ${card.failures}× nicht gewusst` : ''}
            </dd>
            {card.recentReviews.length === 0 ? null : (
              <dd>
                <ol className="mt-1 text-muted-foreground text-xs">
                  {card.recentReviews.map((review) => (
                    <li key={review.reviewedAt}>
                      <time dateTime={review.reviewedAt}>
                        {new Intl.DateTimeFormat('de-DE', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        }).format(new Date(review.reviewedAt))}
                      </time>{' '}
                      · {review.rating === 1 ? 'nicht gewusst' : 'richtig'}
                    </li>
                  ))}
                </ol>
              </dd>
            )}
          </div>
        ))}
      </dl>
    </details>
  );
};
