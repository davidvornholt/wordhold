import type { ReactNode } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { cardListClass } from '../../../shared/ui/surface-styles';
import type { ExamSummary } from '../schemas/exam-models';
import { scorePercent, scoreText } from './exam-figures';

type ExamListProps = {
  readonly exams: ReadonlyArray<ExamSummary>;
  readonly subject: CourseSubject;
  readonly renderExamLink: (exam: ExamSummary) => ReactNode;
};

const summary = (exam: ExamSummary, subject: CourseSubject): string => {
  const nouns = courseNouns(subject);
  const words = countNoun(exam.entryCount, nouns.singular, nouns.plural);
  return exam.lastRound === null
    ? `${words} · noch keine Runde abgeschlossen`
    : `${words} · letzte Runde ${scoreText(exam.lastRound)} (${scorePercent(exam.lastRound)} %)`;
};

const ExamRows = ({ exams, subject, renderExamLink }: ExamListProps) => (
  <ul className={cardListClass}>
    {exams.map((exam) => (
      <li className="flex flex-col gap-0.5 px-4 py-3" key={exam.id}>
        {renderExamLink(exam)}
        <span className="text-muted-foreground text-sm">
          {summary(exam, subject)}
        </span>
      </li>
    ))}
  </ul>
);

// Tests still ahead first; archived ones stay for looking back.
export const ExamList = ({ exams, subject, renderExamLink }: ExamListProps) => {
  const active = exams.filter((exam) => exam.archivedAt === null);
  const archived = exams.filter((exam) => exam.archivedAt !== null);
  return (
    <div className="flex flex-col gap-8">
      {active.length === 0 ? (
        <p className="text-sm">
          Lege einen Test an, sobald du weißt, welche{' '}
          {courseNouns(subject).plural} drankommen. Dann kannst du sie so oft in
          einer Runde abfragen, wie du möchtest, und siehst, wie gut du
          vorbereitet bist.
        </p>
      ) : (
        <ExamRows
          exams={active}
          renderExamLink={renderExamLink}
          subject={subject}
        />
      )}
      {archived.length === 0 ? null : (
        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl">Archiviert</h2>
          <ExamRows
            exams={archived}
            renderExamLink={renderExamLink}
            subject={subject}
          />
        </section>
      )}
    </div>
  );
};
