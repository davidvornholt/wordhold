import type { ReactNode } from 'react';
import {
  type CourseSubject,
  courseNouns,
  directionLabel,
  isRelationDirection,
} from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { Callout } from '../../../shared/ui/callout';
import type { ExamDetail } from '../schemas/exam-models';
import {
  ExamReadinessFigures,
  MissedCards,
  RoundHistory,
} from './exam-readiness';

type ExamOverviewProps = {
  readonly exam: ExamDetail;
  readonly subject: CourseSubject;
  // Starts or continues a round; null while there is nothing to ask.
  readonly roundAction: ReactNode | null;
  // Learns the cards a round leaves out; null when there are none.
  readonly learnAction: ReactNode | null;
  readonly practiceMissedAction: ReactNode;
  readonly manageActions: ReactNode;
};

// Synonyms and antonyms are named once, as one switch turns them on.
const directionsText = (exam: ExamDetail, subject: CourseSubject): string => {
  const translations = exam.directions
    .filter((direction) => !isRelationDirection(direction))
    .map((direction) => directionLabel(direction, subject));
  const relations = exam.directions.some(isRelationDirection)
    ? ['Synonyme und Gegenteile']
    : [];
  return [...translations, ...relations].join(', ');
};

const examSummary = (exam: ExamDetail, subject: CourseSubject): string => {
  const nouns = courseNouns(subject);
  return [
    countNoun(exam.entryCount, nouns.singular, nouns.plural),
    directionsText(exam, subject),
    `${countNoun(exam.cards.learned, 'Karte', 'Karten')} je Runde`,
    exam.archivedAt === null ? null : 'archiviert',
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
};

export const ExamOverview = ({
  exam,
  subject,
  roundAction,
  learnAction,
  practiceMissedAction,
  manageActions,
}: ExamOverviewProps) => (
  <>
    <p className="text-muted-foreground text-sm">
      {examSummary(exam, subject)}
    </p>
    {exam.cards.unlearned === 0 ? null : (
      <Callout tone="neutral">
        <p className="text-sm">
          {countNoun(exam.cards.unlearned, 'Karte', 'Karten')} dieses Tests hast
          du noch nicht kennengelernt. Eine Runde fragt nur Karten ab, die du
          schon kennengelernt hast.
        </p>
        {learnAction}
      </Callout>
    )}
    <div className="flex flex-wrap items-center gap-4">
      {roundAction}
      {manageActions}
    </div>
    <p className="text-muted-foreground text-sm">
      Eine Runde fragt alle Karten des Tests in zufälliger Reihenfolge ab.
      Gezählt wird jeweils die erste Antwort. Eine richtige Antwort vor ihrem
      Termin verschiebt den Lernplan nicht; eine falsche wird früher wieder
      eingeplant.
    </p>
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">Stand</h2>
      <ExamReadinessFigures readiness={exam.readiness} />
    </section>
    <MissedCards
      practiceAction={practiceMissedAction}
      readiness={exam.readiness}
      subject={subject}
    />
    <RoundHistory
      openRoundId={exam.openRound?.id ?? null}
      rounds={exam.rounds}
    />
  </>
);
