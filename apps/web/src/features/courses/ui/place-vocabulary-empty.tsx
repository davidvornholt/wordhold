import type { ReactNode } from 'react';
import { cardClass } from '../../../shared/ui/surface-styles';

type PlaceVocabularyEmptyProps = {
  readonly place: 'book' | 'unit';
  readonly importAction: ReactNode;
  readonly addAction: ReactNode;
};

// The two ways vocabulary enters a book or unit, side by side: a photographed
// page for a whole list, typing for the odd word.
export const PlaceVocabularyEmpty = ({
  place,
  importAction,
  addAction,
}: PlaceVocabularyEmptyProps) => (
  <div className={`${cardClass} flex flex-col items-start gap-4`}>
    <p className="hyphens-auto text-sm">
      Fotografiere eine Vokabelseite und ordne die erkannten Vokabeln beim
      Prüfen {place === 'book' ? 'diesem Buch' : 'dieser Einheit'} zu. Einzelne
      Vokabeln trägst du direkt hier ein.
    </p>
    <div className="flex flex-wrap items-center gap-4">
      {importAction}
      {addAction}
    </div>
  </div>
);
