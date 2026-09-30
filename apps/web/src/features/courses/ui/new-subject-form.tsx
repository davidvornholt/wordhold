import { useId, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { cardClass } from '../../../shared/ui/surface-styles';
import { maximumSubjectNameLength } from '../schemas/subject-management';
import { NameForm } from './name-form';
import { courseNameTaken } from './subject-names';

type NewSubjectFormProps = {
  // Every course on the overview, so a new name is checked against them.
  readonly courses: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly hasSubjects: boolean;
  // Creates the subject and opens its page.
  readonly createSubject: (name: string) => Promise<void>;
};

// Open from the start while there is no subject yet, since adding one is
// then the only thing the section offers.
export const NewSubjectForm = ({
  courses,
  createSubject,
  hasSubjects,
}: NewSubjectFormProps) => {
  const [adding, setAdding] = useState(!hasSubjects);
  const [creating, setCreating] = useState(false);
  const formId = useId();
  return (
    <div className="flex flex-col items-start gap-3">
      {hasSubjects ? (
        <Button
          aria-controls={adding ? formId : undefined}
          aria-expanded={adding}
          onClick={() => setAdding((current) => !current)}
          variant="quiet"
        >
          {adding ? 'Abbrechen' : 'Neues Fach'}
        </Button>
      ) : null}
      {adding ? (
        <div className={`${cardClass} flex w-full flex-col gap-2`} id={formId}>
          <NameForm
            busy={creating}
            conflict={(name) => courseNameTaken(courses, name)}
            failedStatus="Das Fach wurde nicht angelegt. Versuche es noch einmal."
            label="Name des Fachs"
            maxLength={maximumSubjectNameLength}
            onBusyChange={setCreating}
            pendingStatus="Fach wird angelegt …"
            placeholder="z. B. Chemie"
            save={createSubject}
            savedStatus={(name) => `${name} angelegt.`}
            statusLabel="Status beim Anlegen eines Fachs"
            submitLabel="Fach anlegen"
          />
        </div>
      ) : null}
    </div>
  );
};
