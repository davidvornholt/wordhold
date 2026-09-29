import type { ReactNode } from 'react';
import type { CourseSubject } from '../../../shared/directions';
import { cardClass } from '../../../shared/ui/surface-styles';

type PlaceVocabularyEmptyProps = {
  readonly place: 'book' | 'unit';
  readonly subject: CourseSubject;
  // Null for a subject, whose terms are only typed.
  readonly importAction: ReactNode | null;
  readonly addAction: ReactNode;
};

const emptyText = (place: 'book' | 'unit', { kind }: CourseSubject): string => {
  if (kind === 'terms') {
    return `Trag hier die Begriffe ${place === 'book' ? 'dieses Buchs' : 'dieser Einheit'} mit ihrer Definition ein. Beim Üben siehst du den Begriff und schreibst die Definition.`;
  }
  return `Fotografiere eine Vokabelseite und ordne die erkannten Vokabeln beim Prüfen ${place === 'book' ? 'diesem Buch' : 'dieser Einheit'} zu. Einzelne Vokabeln trägst du direkt hier ein.`;
};

// The ways entries reach a book or unit. A language offers two side by side:
// a photographed page for a whole list, typing for the odd word.
export const PlaceVocabularyEmpty = ({
  place,
  subject,
  importAction,
  addAction,
}: PlaceVocabularyEmptyProps) => (
  <div className={`${cardClass} flex flex-col items-start gap-4`}>
    <p className="hyphens-auto text-sm">{emptyText(place, subject)}</p>
    <div className="flex flex-wrap items-center gap-4">
      {importAction}
      {addAction}
    </div>
  </div>
);
