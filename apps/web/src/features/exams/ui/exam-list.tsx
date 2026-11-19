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

// The first tests in the store's order stay in view; the older ones are
// rarely opened, so they fold away.
const shownExams = 3;

type ExamSectionProps = ExamRowsProps & {
  readonly newExamAction: ReactNode;
};

// The course's tests in the store's order. Without a test the section is one
// quiet line, since most of the time none is due.
export const ExamSection = ({
  exams,
  subject,
  renderExamLink,
  newExamAction,
}: ExamSectionProps) => {
  const headingId = useId();
  const folded = exams.slice(shownExams);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-xl" id={headingId}>
          Tests
        </h2>
        {newExamAction}
      </div>
      {exams.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {`Lege einen Test an, sobald du weißt, welche ${courseNouns(subject).plural} drankommen. Dann fragst du sie in Runden ab und siehst, wie gut du vorbereitet bist.`}
        </p>
      ) : (
        <ExamRows
          exams={exams.slice(0, shownExams)}
          renderExamLink={renderExamLink}
          subject={subject}
        />
      )}
      {folded.length === 0 ? null : (
        <details>
          <summary className="min-h-11 w-fit cursor-pointer py-3 text-muted-foreground text-sm">
            {countNoun(folded.length, 'weiterer Test', 'weitere Tests')}
          </summary>
          <ExamRows
            exams={folded}
            renderExamLink={renderExamLink}
            subject={subject}
          />
        </details>
      )}
    </section>
  );
};
