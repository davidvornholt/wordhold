import { type ReactNode, useId } from 'react';
import { cardClass } from '../../../shared/ui/surface-styles';

type UnitVocabularyEmptyProps = {
  readonly importAction: ReactNode;
};

export const UnitVocabularyEmpty = ({
  importAction,
}: UnitVocabularyEmptyProps) => {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 className="font-display text-xl" id={headingId}>
        Vokabeln hinzufügen
      </h2>
      <div className={`${cardClass} flex flex-col items-start gap-4`}>
        <p className="hyphens-auto text-sm">
          Fotografiere eine Vokabelseite. Beim Prüfen ordnest du die erkannten
          Vokabeln dieser Einheit zu.
        </p>
        {importAction}
      </div>
    </section>
  );
};
