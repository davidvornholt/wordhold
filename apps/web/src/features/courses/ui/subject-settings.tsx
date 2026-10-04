import type { ListCourseKind } from '../../../shared/directions';
import { cardClass } from '../../../shared/ui/surface-styles';
import { maximumSubjectNameLength } from '../schemas/subject-management';
import { NameForm } from './name-form';
import { courseNameTaken } from './subject-names';

type SubjectSettingsProps = {
  readonly courseId: string;
  readonly kind: ListCourseKind;
  readonly name: string;
  // Every course on the overview, so a new name is checked against them.
  readonly courses: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly rename: (name: string) => Promise<void>;
};

const labels = {
  terms: {
    failedStatus: 'Das Fach wurde nicht umbenannt. Versuche es noch einmal.',
    label: 'Name des Fachs',
    pendingStatus: 'Fach wird umbenannt …',
    placeholder: 'z. B. Chemie',
    statusLabel: 'Status beim Umbenennen des Fachs',
    grading:
      'Beim Üben siehst du den Begriff und schreibst seine Definition. Eine Antwort zählt, wenn sie alle Kernpunkte enthält. Eigene Worte sind erlaubt, die Fachbegriffe müssen vorkommen.',
  },
  texts: {
    failedStatus:
      'Die Sammlung wurde nicht umbenannt. Versuche es noch einmal.',
    label: 'Name der Sammlung',
    pendingStatus: 'Sammlung wird umbenannt …',
    placeholder: 'z. B. Bibelverse',
    statusLabel: 'Status beim Umbenennen der Sammlung',
    grading:
      'Beim Üben siehst du den Titel und schreibst den Text aus dem Gedächtnis. Es zählen nur die Wörter, nicht Groß- und Kleinschreibung, Satzzeichen oder Zeilen. Ein einzelner vertippter Buchstabe in einem längeren Wort ist kein Fehler. Ohne Fehler sitzt der Text. Mit bis zu einem Fehler pro zehn Wörter zählt er noch, kommt aber früher wieder.',
  },
} as const satisfies Record<ListCourseKind, Record<string, string>>;

// A subject or collection is asked in one direction only, so its settings
// are its name.
export const SubjectSettings = ({
  courseId,
  kind,
  name,
  courses,
  rename,
}: SubjectSettingsProps) => {
  const { grading, ...text } = labels[kind];
  return (
    <div className="flex flex-col gap-6">
      <div className={`${cardClass} flex flex-col gap-2`}>
        <NameForm
          conflict={(next) => courseNameTaken(courses, next, courseId)}
          initialName={name}
          maxLength={maximumSubjectNameLength}
          save={rename}
          savedStatus={(next) => `Umbenannt in ${next}.`}
          submitLabel="Umbenennen"
          {...text}
        />
      </div>
      <p className="text-muted-foreground text-sm">{grading}</p>
    </div>
  );
};
