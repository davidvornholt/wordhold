# @wordhold/ui

Shared design tokens for the Wordhold web app.

Currently this package hosts the **design bake-off**: two candidate themes
that define the *same semantic token names* with different value sets, each
scoped to a wrapper class so both can render side by side in one app.

| Theme | Wrapper class | Character |
| --- | --- | --- |
| `themes/heirloom.css` | `.theme-heirloom` | Carded surfaces, Spectral serif display, forest green, square corners. |
| `themes/warm-print.css` | `.theme-warm-print` | Flat print layout, rules over boxes, Fraunces display, parchment and register red, square corners. |

Both themes opt into dark mode via `prefers-color-scheme` (no toggle).
`src/themes/tokens.test.ts` enforces that the two files declare an identical
set of custom properties, so the app can switch themes by swapping the
wrapper class alone.

Once a winner is chosen, `/design-init` turns it into the repo's real
`DESIGN.md` + `theme.css` and the loser is deleted.

## Configuration

This package reads no environment variables.
