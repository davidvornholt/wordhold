import { maximumSubjectNameLength } from '../schemas/subject-management';
import { NameDialog } from './name-dialog';
import { courseNameTaken } from './subject-names';

type NewSubjectDialogProps = {
  // Every course on the overview, so a new name is checked against them.
  readonly courses: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  // Creates the subject and opens its page.
  readonly createSubject: (name: string) => Promise<void>;
};

export const NewSubjectDialog = ({
  courses,
  createSubject,
}: NewSubjectDialogProps) => (
  <NameDialog
    conflict={(name) => courseNameTaken(courses, name)}
    failedMessage="Das Fach wurde nicht angelegt. Versuche es noch einmal."
    label="Name des Fachs"
    maxLength={maximumSubjectNameLength}
    openLabel="Neues Fach"
    pendingLabel="Fach wird angelegt …"
    placeholder="z. B. Chemie"
    save={createSubject}
    submitLabel="Fach anlegen"
    title="Neues Fach"
  />
);
