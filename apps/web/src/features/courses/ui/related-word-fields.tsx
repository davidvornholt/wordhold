import { useId } from 'react';
import { entryTranslationLineClass } from '../../../shared/ui/field-styles';
import {
  type RelationKind,
  relationKinds,
  relationLabels,
} from '../../../shared/vocabulary/related-words';

export type RelatedWordTexts = Readonly<Record<RelationKind, string>>;

type RelatedWordFieldsProps = {
  readonly texts: RelatedWordTexts;
  readonly disabled: boolean;
  readonly onChange: (texts: RelatedWordTexts) => void;
};

// A word's synonyms and antonyms, each typed as one comma-separated list.
export const RelatedWordFields = ({
  texts,
  disabled,
  onChange,
}: RelatedWordFieldsProps) => {
  const id = useId();
  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {relationKinds.map((kind) => (
        <div className="flex flex-col gap-1" key={kind}>
          <label className="eyebrow" htmlFor={`${id}-${kind}`}>
            {relationLabels[kind]} (mit Komma getrennt)
          </label>
          <input
            className={entryTranslationLineClass}
            disabled={disabled}
            id={`${id}-${kind}`}
            onChange={(event) =>
              onChange({ ...texts, [kind]: event.target.value })
            }
            value={texts[kind]}
          />
        </div>
      ))}
    </div>
  );
};
