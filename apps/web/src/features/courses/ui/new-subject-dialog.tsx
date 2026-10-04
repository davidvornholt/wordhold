import type { ListCourseKind } from '../../../shared/directions';
import { maximumSubjectNameLength } from '../schemas/subject-management';
import { NameDialog } from './name-dialog';
import { courseNameTaken } from './subject-names';

type NewSubjectDialogProps = {
  // A subject of terms or a collection of texts.
  readonly kind: ListCourseKind;
  // Every course on the overview, so a new name is checked against them.
  readonly courses: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  // Creates the subject or collection and opens its page.
  readonly createSubject: (name: string) => Promise<void>;
};

const labels = {
  terms: {
    failedMessage: 'Das Fach wurde nicht angelegt. Versuche es noch einmal.',
    label: 'Name des Fachs',
    title: 'Neues Fach',
    pendingLabel: 'Fach wird angelegt …',
    placeholder: 'z. B. Chemie',
    submitLabel: 'Fach anlegen',
  },
  texts: {
    failedMessage:
      'Die Sammlung wurde nicht angelegt. Versuche es noch einmal.',
    label: 'Name der Sammlung',
    title: 'Neue Sammlung',
    pendingLabel: 'Sammlung wird angelegt …',
    placeholder: 'z. B. Bibelverse',
    submitLabel: 'Sammlung anlegen',
  },
} as const satisfies Record<ListCourseKind, Record<string, string>>;

export const NewSubjectDialog = ({
  kind,
  courses,
  createSubject,
}: NewSubjectDialogProps) => {
  const { title, ...text } = labels[kind];
  return (
    <NameDialog
      conflict={(name) => courseNameTaken(courses, name)}
      maxLength={maximumSubjectNameLength}
      openLabel={title}
      save={createSubject}
      title={title}
      {...text}
    />
  );
};
