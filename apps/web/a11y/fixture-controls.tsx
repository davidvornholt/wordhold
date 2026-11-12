import { SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ActionVariant } from '../src/shared/ui/action-styles';
import { Button } from '../src/shared/ui/button';
import { type FixtureState, navigateToFixture } from './fixture-state';

// Fixtures run without the router, so navigation renders as buttons styled
// through the same action primitives the app uses for its links.
export const fixtureControl = (
  label: string,
  destination: FixtureState,
  variant: ActionVariant,
) => (
  <Button onClick={() => navigateToFixture(destination)} variant={variant}>
    {label}
  </Button>
);

export const fixtureBackControl = (
  label: string,
  destination: FixtureState,
) => (
  <button
    className="inline-flex min-h-11 w-fit items-center text-muted-foreground text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
    onClick={() => navigateToFixture(destination)}
    type="button"
  >
    ← {label}
  </button>
);

// A square glyph control, such as the settings beside a course's title.
export const fixtureIconControl = (
  label: string,
  destination: FixtureState,
  icon: ReactNode,
) => (
  <Button
    aria-label={label}
    onClick={() => navigateToFixture(destination)}
    title={label}
    variant="icon"
  >
    {icon}
  </Button>
);

// The gear beside a course's title, leading to its settings.
export const fixtureSettingsControl = (destination: FixtureState) =>
  fixtureIconControl(
    'Einstellungen',
    destination,
    <SettingsIcon aria-hidden={true} className="size-5" />,
  );
