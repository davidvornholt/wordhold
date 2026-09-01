import {
  RootError,
  RootNotFound,
  RootPending,
} from '../src/shared/routing/root-feedback';
import { type FixtureState, navigateToFixture } from './fixture-state';

export const rootFixture = (state: FixtureState) => {
  switch (state) {
    case 'loading':
      return <RootPending />;
    case 'error':
      return (
        <RootError
          error={new Error('Database unavailable')}
          reset={() => navigateToFixture('dashboard')}
        />
      );
    case 'not-found':
      return <RootNotFound />;
    default:
      return null;
  }
};
