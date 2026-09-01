import type { ReactNode } from 'react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { countNoun } from '../../../shared/format/count';
import { RadioButton } from '../../../shared/ui/selection-controls';
import type { SessionDirection } from '../schemas/session-request';
import type { SessionOption } from '../services/session-options';

type SessionStartProps = {
  readonly options: ReadonlyArray<SessionOption>;
  readonly itemNoun: { readonly singular: string; readonly plural: string };
  // Scoped per course AND per mode, so the direction remembered for scheduled
  // practice never silently preselects a direction in free study.
  readonly preferenceKey: string;
  readonly renderStartAction: (
    option: SessionOption,
    rememberDirection: () => void,
  ) => ReactNode;
};

const subscribeToNothing = () => () => undefined;

const readPreference = (storageKey: string): string | null => {
  try {
    return globalThis.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
};

const writePreference = (storageKey: string, value: string): void => {
  try {
    globalThis.localStorage.setItem(storageKey, value);
  } catch {
    // Remembering the choice is optional. The explicit selection still starts.
  }
};

const optionStatus = (
  option: SessionOption,
  itemNoun: SessionStartProps['itemNoun'],
): string => {
  if (option.availability === 'needs_both_directions') {
    return 'In einer Richtung fehlen Karten';
  }
  if (option.availability === 'no_cards') {
    return `Keine ${itemNoun.plural} bereit`;
  }
  return countNoun(option.cards, itemNoun.singular, itemNoun.plural);
};

export const SessionStart = ({
  options,
  itemNoun,
  preferenceKey,
  renderStartAction,
}: SessionStartProps) => {
  const legend = useRef<HTMLLegendElement>(null);
  useEffect(() => {
    const focusTask = globalThis.setTimeout(() => legend.current?.focus());
    return () => globalThis.clearTimeout(focusTask);
  }, []);
  const storageKey = `wordhold-practice-direction-${preferenceKey}`;
  const remembered = useSyncExternalStore(
    subscribeToNothing,
    () => readPreference(storageKey),
    () => null,
  );
  // A remembered direction that has no cards right now would start an empty
  // sitting, so it falls back to an explicit choice.
  const rememberedDirection = options.some(
    (candidate) =>
      candidate.value === remembered && candidate.availability === 'available',
  )
    ? (remembered as SessionDirection)
    : null;
  const [chosen, setChosen] = useState<SessionDirection | null>(null);
  const selected = chosen ?? rememberedDirection;
  const selectedOption = options.find(
    (candidate) =>
      candidate.value === selected && candidate.availability === 'available',
  );
  return (
    <section className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend
          className="mb-3 font-display text-xl focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          ref={legend}
          tabIndex={-1}
        >
          Welche Richtung?
        </legend>
        {options.map((candidate) => (
          <label
            className={`grid min-h-11 gap-2 border border-border bg-card p-4 sm:grid-cols-2 sm:items-center ${
              candidate.availability === 'available'
                ? 'cursor-pointer'
                : 'opacity-50'
            }`}
            htmlFor={`practice-direction-${candidate.value}`}
            key={candidate.value}
          >
            <span className="flex items-start gap-3">
              <RadioButton
                checked={selected === candidate.value}
                className="mt-1"
                disabled={candidate.availability !== 'available'}
                id={`practice-direction-${candidate.value}`}
                name="practice-direction"
                onChange={() => setChosen(candidate.value)}
              />
              <span className="flex flex-col gap-1">
                <span className="font-medium">{candidate.label}</span>
                <span className="text-muted-foreground text-sm">
                  {candidate.description}
                </span>
              </span>
            </span>
            <span className="text-muted-foreground text-sm sm:text-right">
              {optionStatus(candidate, itemNoun)}
            </span>
          </label>
        ))}
      </fieldset>
      {selectedOption === undefined ? (
        <p className="text-muted-foreground text-sm">
          Wähle eine Richtung, um den Umfang vor dem Start zu sehen.
        </p>
      ) : (
        renderStartAction(selectedOption, () =>
          writePreference(storageKey, selectedOption.value),
        )
      )}
    </section>
  );
};
