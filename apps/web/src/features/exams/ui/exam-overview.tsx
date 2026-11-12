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
import { MissedCards, RoundHistory } from './exam-readiness';
import { ExamStanding } from './exam-standing';

type ExamOverviewProps = {
  readonly exam: ExamDetail;
  readonly subject: CourseSubject;
  // Starts or continues a round, or brings an archived test back; null
  // while there is nothing to ask.
  readonly roundAction: ReactNode | null;
  // Learns the cards a round leaves out; null when the learning pass has none
  // of them.
  readonly learnAction: ReactNode | null;
  readonly practiceMissedAction: ReactNode;
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

const switchedOffText = (count: number): string =>
  `${countNoun(count, 'Karte', 'Karten')} davon ${count === 1 ? 'gehört' : 'gehören'} zu einer Richtung, die in den Einstellungen ausgeschaltet ist. Du lernst sie erst kennen, wenn du diese Richtung dort einschaltest.`;

const unlearnedText = (cards: ExamDetail['cards']): string =>
  [
    `${countNoun(cards.unlearned, 'Karte', 'Karten')} dieses Tests hast du noch nicht kennengelernt.`,
    cards.switchedOff === 0 ? null : switchedOffText(cards.switchedOff),
    'Eine Runde fragt nur Karten ab, die du schon kennengelernt hast.',
  ]
    .filter((sentence): sentence is string => sentence !== null)
    .join(' ');

// An archived test starts no round, so it leaves out what prepares one.
export const ExamOverview = ({
  exam,
  subject,
  roundAction,
  learnAction,
  practiceMissedAction,
}: ExamOverviewProps) => (
  <>
    <p className="text-muted-foreground text-sm">
      {examSummary(exam, subject)}
    </p>
    {exam.cards.unlearned === 0 || exam.archivedAt !== null ? null : (
      <Callout tone="neutral">
        <p className="text-sm">{unlearnedText(exam.cards)}</p>
        {learnAction}
      </Callout>
    )}
    {roundAction}
    {exam.archivedAt === null ? (
      <p className="text-muted-foreground text-sm">
        Eine Runde fragt alle Karten des Tests in zufälliger Reihenfolge ab.
        Gezählt wird jeweils die erste Antwort. Eine richtige Antwort vor ihrem
        Termin verschiebt den Lernplan nicht; eine falsche wird früher wieder
        eingeplant.
      </p>
    ) : null}
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl">Stand</h2>
      <ExamStanding readiness={exam.readiness} rounds={exam.rounds} />
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
