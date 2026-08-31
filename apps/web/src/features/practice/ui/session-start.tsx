import type { ReactNode } from 'react';
import { useState, useSyncExternalStore } from 'react';
import { countNoun } from '../../../shared/format/count';
import { RadioButton } from '../../../shared/ui/selection-controls';
import type { SessionDirection } from '../schemas/session-request';
import type { SessionOption } from '../services/session-options';

type SessionStartProps = {
  readonly options: ReadonlyArray<SessionOption>;
  // Scoped per course AND per mode, so the direction remembered for scheduled
  // practice never silently preselects a direction in free study.
  readonly preferenceKey: string;
  readonly renderStartAction: (
    option: SessionOption,
    rememberDirection: () => void,
  ) => ReactNode;
};

const subscribeToNothing = () => () => undefined;

export const SessionStart = ({
  options,
  preferenceKey,
  renderStartAction,
}: SessionStartProps) => {
  const storageKey = `wordhold-practice-direction-${preferenceKey}`;
  const remembered = useSyncExternalStore(
    subscribeToNothing,
    () => globalThis.localStorage.getItem(storageKey),
    () => null,
  );
  // A remembered direction that has no cards right now would start an empty
  // sitting, so it falls back to an explicit choice.
  const rememberedDirection = options.some(
    (candidate) => candidate.value === remembered && candidate.cards > 0,
  )
    ? (remembered as SessionDirection)
    : null;
  const [chosen, setChosen] = useState<SessionDirection | null>(null);
  const selected = chosen ?? rememberedDirection;
  const selectedOption = options.find(
    (candidate) => candidate.value === selected && candidate.cards > 0,
  );
  return (
    <section className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-xl">Welche Richtung?</legend>
        {options.map((candidate) => (
          <label
            className={`grid min-h-11 gap-2 border border-border bg-card p-4 sm:grid-cols-2 sm:items-center ${
              candidate.cards === 0 ? 'opacity-50' : 'cursor-pointer'
            }`}
            htmlFor={`practice-direction-${candidate.value}`}
            key={candidate.value}
          >
            <span className="flex items-start gap-3">
              <RadioButton
                checked={selected === candidate.value}
                className="mt-1"
                disabled={candidate.cards === 0}
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
              {candidate.cards === 0
                ? 'Keine Karten bereit'
                : countNoun(candidate.cards, 'Karte', 'Karten')}
            </span>
          </label>
        ))}
      </fieldset>
      {selectedOption === undefined ? (
        <p className="text-muted-foreground text-sm">
          Wähle eine Richtung, um die Kartenzahl vor dem Start zu sehen.
        </p>
      ) : (
        renderStartAction(selectedOption, () =>
          globalThis.localStorage.setItem(storageKey, selectedOption.value),
        )
      )}
    </section>
  );
};
