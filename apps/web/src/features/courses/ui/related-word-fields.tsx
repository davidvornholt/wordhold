import { useId } from 'react';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
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
    <div className="grid gap-3 sm:grid-cols-2">
      {relationKinds.map((kind) => (
        <div className="flex flex-col gap-1 text-sm" key={kind}>
          <label className="font-medium" htmlFor={`${id}-${kind}`}>
            {relationLabels[kind]}
            <span className="font-normal text-muted-foreground">
              {' '}
              (mit Komma getrennt)
            </span>
          </label>
          <input
            className={fieldOnCardClass}
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
