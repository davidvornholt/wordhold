import { Button } from '../../../shared/ui/button';
import { fieldOnCardClass } from '../../../shared/ui/field-styles';
import type { TextSource } from './text-lookup';

type TextLookupControlsProps = {
  readonly sources: ReadonlyArray<TextSource>;
  readonly source: TextSource;
  readonly pick: (sourceId: string) => void;
  readonly disabled: boolean;
  readonly onLookUp: () => void;
};

// With one Bible the button names it; with several, the learner picks one.
export const TextLookupControls = ({
  sources,
  source,
  pick,
  disabled,
  onLookUp,
}: TextLookupControlsProps) => (
  <div className="flex flex-wrap items-end gap-3">
    {sources.length > 1 ? (
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Bibel</span>
        <select
          className={fieldOnCardClass}
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
    <Button disabled={disabled} onClick={onLookUp} variant="outline">
      {sources.length > 1 ? 'Nachschlagen' : `In ${source.label} nachschlagen`}
    </Button>
  </div>
);
