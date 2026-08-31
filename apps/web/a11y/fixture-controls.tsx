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
