# @wordhold/ui

Shared design tokens for the Wordhold web app.

`src/theme.css` is the single token source: the "heirloom-product" theme
(winner of the design bake-off), applied at `:root`. Carded surfaces on warm
off-white, Spectral serif display over Hanken Grotesk body, forest green as
the single strong color, square corners throughout. Dark mode comes from
`prefers-color-scheme` (no toggle).

All app color and type decisions consume these tokens through the Tailwind
utilities mapped in `apps/web/src/styles.css`; no raw color values in app
code. The design intent lives in the root `DESIGN.md`.

`src/theme.test.ts` enforces that every color token has a dark-mode
override and that dark mode introduces no tokens of its own.

## Configuration

This package reads no environment variables.
