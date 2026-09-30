import { cardClass } from '../../../shared/ui/surface-styles';
import { maximumSubjectNameLength } from '../schemas/subject-management';
import { NameForm } from './name-form';
import { courseNameTaken } from './subject-names';

type SubjectSettingsProps = {
  readonly courseId: string;
  readonly name: string;
  // Every course on the overview, so a new name is checked against them.
  readonly courses: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly rename: (name: string) => Promise<void>;
};

// A subject is asked in one direction only, so its settings are its name.
export const SubjectSettings = ({
  courseId,
  name,
  courses,
  rename,
}: SubjectSettingsProps) => (
  <div className="flex flex-col gap-6">
    <div className={`${cardClass} flex flex-col gap-2`}>
      <NameForm
        conflict={(next) => courseNameTaken(courses, next, courseId)}
        failedStatus="Das Fach wurde nicht umbenannt. Versuche es noch einmal."
        initialName={name}
        label="Name des Fachs"
        maxLength={maximumSubjectNameLength}
        pendingStatus="Fach wird umbenannt …"
        placeholder="z. B. Chemie"
        save={rename}
        savedStatus={(next) => `Umbenannt in ${next}.`}
        statusLabel="Status beim Umbenennen des Fachs"
        submitLabel="Umbenennen"
      />
    </div>
    <p className="text-muted-foreground text-sm">
      Beim Üben siehst du den Begriff und schreibst seine Definition. Eine
      Antwort zählt, wenn sie alle Kernpunkte enthält. Eigene Worte sind
      erlaubt, die Fachbegriffe müssen vorkommen.
    </p>
  </div>
);
