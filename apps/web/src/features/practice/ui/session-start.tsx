import type { ReactNode } from 'react';
import type { SessionOption } from '../services/session-options';

type SessionStartProps = {
  readonly options: ReadonlyArray<SessionOption>;
  readonly renderStartAction: (option: SessionOption) => ReactNode;
};

// The start of a sitting. The direction is picked here rather than carried
// over from last time, because which way round you want to be asked changes
// with what you are revising for.
export const SessionStart = ({
  options,
  renderStartAction,
}: SessionStartProps) => (
  <section className="flex flex-col gap-3">
    <h2 className="font-display text-xl">Welche Richtung?</h2>
    <ul className="flex flex-col gap-3">
      {options.map((option) => (
        <li
          className="flex flex-col gap-1 border border-border bg-card p-4"
          key={option.value}
        >
          {renderStartAction(option)}
          <p className="text-muted-foreground text-sm">{option.description}</p>
        </li>
      ))}
    </ul>
  </section>
);
