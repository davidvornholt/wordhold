import type { ReactNode } from 'react';
import { useState, useSyncExternalStore } from 'react';
import type { SessionDirection } from '../schemas/session-request';
import type { SessionOption } from '../services/session-options';

type SessionStartProps = {
  readonly options: ReadonlyArray<SessionOption>;
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
  const rememberedDirection = options.some(
    (candidate) => candidate.value === remembered,
  )
    ? (remembered as SessionDirection)
    : null;
  const [chosen, setChosen] = useState<SessionDirection | null>(null);
  const selected = chosen ?? rememberedDirection;
  const selectedOption = options.find(
    (candidate) => candidate.value === selected,
  );
  return (
    <section className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-display text-xl">Welche Richtung?</legend>
        {options.map((candidate) => (
          <label
            className="grid min-h-11 cursor-pointer gap-2 border border-border bg-card p-4 sm:grid-cols-2 sm:items-center"
            key={candidate.value}
          >
            <span className="flex items-start gap-3">
              <input
                checked={selected === candidate.value}
                className="mt-1 size-5 accent-primary"
                name="practice-direction"
                onChange={() => setChosen(candidate.value)}
                type="radio"
              />
              <span className="flex flex-col gap-1">
                <span className="font-medium">{candidate.label}</span>
                <span className="text-muted-foreground text-sm">
                  {candidate.description}
                </span>
              </span>
            </span>
            <span className="text-muted-foreground text-sm sm:text-right">
              {candidate.cards} {candidate.cards === 1 ? 'Karte' : 'Karten'}
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
