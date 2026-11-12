import { type ReactNode, useId } from 'react';
import { type CourseSubject, courseNouns } from '../../../shared/directions';
import { countNoun } from '../../../shared/format/count';
import { cardListClass } from '../../../shared/ui/surface-styles';
import type { ExamSummary } from '../schemas/exam-models';
import { scorePercent, scoreText } from './exam-figures';

type ExamRowsProps = {
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

const ExamRows = ({ exams, subject, renderExamLink }: ExamRowsProps) => (
  <ul className={cardListClass}>
    {exams.map((exam) => (
      <li
        className="flex flex-col gap-0.5 px-4 py-3 hover:bg-muted/50"
        key={exam.id}
      >
        {renderExamLink(exam)}
        <span className="text-muted-foreground text-sm">
          {summary(exam, subject)}
        </span>
      </li>
    ))}
  </ul>
);

type ExamSectionProps = ExamRowsProps & {
  readonly newExamAction: ReactNode;
  // Opens the archived tests; called only while there are some.
  readonly renderArchiveLink: (count: number) => ReactNode;
};

// The course's tests still ahead, under its books or above its list.
// Archived ones stay on a page of their own for looking back. Without a test
// the section is one quiet line, since most of the time none is due.
export const ExamSection = ({
  exams,
  subject,
  renderExamLink,
  newExamAction,
  renderArchiveLink,
}: ExamSectionProps) => {
  const headingId = useId();
  const active = exams.filter((exam) => exam.archivedAt === null);
  const archived = exams.length - active.length;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          Tests
        </h2>
        {newExamAction}
      </div>
      {active.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {archived === 0
            ? `Lege einen Test an, sobald du weißt, welche ${courseNouns(subject).plural} drankommen. Dann fragst du sie in Runden ab und siehst, wie gut du vorbereitet bist.`
            : 'Gerade steht kein Test an.'}
        </p>
      ) : (
        <ExamRows
          exams={active}
          renderExamLink={renderExamLink}
          subject={subject}
        />
      )}
      {archived === 0 ? null : renderArchiveLink(archived)}
    </section>
  );
};

export const ArchivedExamList = ({
  exams,
  subject,
  renderExamLink,
}: ExamRowsProps) => {
  const archived = exams.filter((exam) => exam.archivedAt !== null);
  return archived.length === 0 ? (
    <p className="text-sm">Kein Test ist archiviert.</p>
  ) : (
    <ExamRows
      exams={archived}
      renderExamLink={renderExamLink}
      subject={subject}
    />
  );
};
