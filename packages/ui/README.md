# @wordhold/ui

Shared design tokens for the Wordhold web app.

`src/theme.css` is the single token source, applied at `:root`. Dark mode
comes from `prefers-color-scheme` with no application toggle.

All app color and type decisions consume these tokens through the Tailwind
utilities mapped in `apps/web/src/styles.css`; no raw color values in app
code.

`src/theme.test.ts` enforces that every color token has a dark-mode
override and that dark mode introduces no tokens of its own.

## Configuration

This package reads no environment variables.
