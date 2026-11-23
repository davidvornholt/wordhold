import { BookOpenIcon } from 'lucide-react';
import { Button } from '../../../shared/ui/button';
import { entryChoiceLineClass } from '../../../shared/ui/field-styles';
import type { TextSource } from './text-lookup';

type TextLookupControlsProps = {
  readonly sources: ReadonlyArray<TextSource>;
  readonly source: TextSource;
  readonly pick: (sourceId: string) => void;
  readonly disabled: boolean;
  readonly onLookUp: () => void;
};

// With one Bible the button names it; with several, the learner picks one.
// The button is plain text whose words line up with the field above it.
export const TextLookupControls = ({
  sources,
  source,
  pick,
  disabled,
  onLookUp,
}: TextLookupControlsProps) => (
  <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
    {sources.length > 1 ? (
      <label className="flex flex-col gap-1 text-sm">
        <span className="eyebrow">Bibel</span>
        <select
          className={entryChoiceLineClass}
          disabled={disabled}
          onChange={(event) => pick(event.target.value)}
          value={source.id}
        >
          {sources.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
    ) : null}
    <Button
      className="-mx-3"
      disabled={disabled}
      onClick={onLookUp}
      variant="text"
    >
      <BookOpenIcon aria-hidden={true} className="size-4" />
      {sources.length > 1 ? 'Nachschlagen' : `In ${source.label} nachschlagen`}
    </Button>
  </div>
);
