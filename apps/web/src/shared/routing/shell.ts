import type { StaticDataRouteOption } from '@tanstack/react-router';

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: Module augmentation needs an interface to merge into the router's declaration.
  interface StaticDataRouteOption {
    readonly shell?: 'focus';
  }
}

// Routes that need the whole viewport for one task declare this static data
// and the root layout leaves out the home shell's top bar.
export const focusShell = {
  shell: 'focus',
} as const satisfies StaticDataRouteOption;

export const usesFocusShell = (
  matches: ReadonlyArray<{ readonly staticData: StaticDataRouteOption }>,
): boolean => matches.some((match) => match.staticData.shell === 'focus');
