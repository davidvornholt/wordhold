# Wordhold design

Wordhold turns photographed schoolbook vocabulary pages into adaptive practice. The design direction is "Heirloom": the quiet confidence of a well-made schoolbook — warm paper, a serif that feels printed rather than rendered, one deep forest green doing all the accent work, and square corners throughout. It was chosen in a two-theme bake-off and is now the single app-wide theme.

## Token source

All colors and fonts come from `packages/ui/src/theme.css` (imported as `@wordhold/ui/theme.css`), defined at `:root` as oklch values with a full dark-scheme override via `prefers-color-scheme`. `apps/web/src/styles.css` maps them to Tailwind utilities through `@theme inline`.

Rules:

- No raw color values (`#hex`, `oklch(...)`, `rgb(...)`) in app or component code, and no default Tailwind palette classes (`text-neutral-500`, `bg-red-50`, …). Use only semantic utilities: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-primary-foreground`, `bg-accent`, `text-accent-foreground`, `bg-warning`, `text-warning-foreground`, `text-destructive`, `bg-destructive/10`, `border-border`, `border-input`.
- If a needed token does not exist, add a semantic one to `theme.css` (light and dark values) and report it, rather than reusing a nearby token that means something else.
- Every color token must have a dark override; `packages/ui/src/theme.test.ts` enforces this.

## Type

- Display face: Spectral (serif), loaded at 400, 600, and 400-italic only — never use `font-medium` on `font-display` text; the weight does not exist and the browser would synthesize it.
- Body face: Hanken Grotesk (variable).
- Headings use `font-display`: page titles `font-display font-semibold text-2xl` (brand `text-3xl`), section headings `font-display text-xl`. Large statistics (the due count) use `font-display text-3xl`.

## Shape and surfaces

- Square corners everywhere: `--radius` is `0px` and no `rounded-*` classes are used.
- Content sits in bordered cards: `border border-border bg-card` on the warm off-white page background. Lists that are not cards use hairline dividers (`divide-y divide-border`).

## Page column

Every screen anchors its navigation and title to the same column: the `page-column` utility in `apps/web/src/styles.css` (`mx-auto w-full max-w-3xl`), plus `p-6` and whatever vertical rhythm the screen needs. Moving between the overview, a course, a unit, a sitting, or a page review never shifts those anchors sideways. A task that needs more room may widen only its workbench. The verification screen keeps its header in the shared column, stacks a centered photograph and form on narrower screens, then gives both panes equal room in a wider two-column workbench at the `xl` breakpoint.

## Shared primitives

All interactive and stateful chrome composes the primitives in `apps/web/src/shared/ui/` instead of restating utility strings:

- Actions: `Button` and the router-typed `ActionLink` share `action-styles.ts` (variants `primary`, `outline`, `destructive`, `quiet`, `quiet-muted`; all `min-h-11` with the shared focus ring). `BackLink` is the one upper-left return control and always reads `← <destination name>`.
- Layout: `PageLayout` renders the page column, back control, and `h1` for every screen. Surfaces come from `surface-styles.ts` (`cardClass`, `cardCompactClass`, `cardListClass`).
- Fields: `field-styles.ts` (`fieldClass` on the page background, `fieldOnCardClass` on cards, `fieldCompactClass` for dense workbench rows). Inputs are `text-base` so mobile Safari never zooms.
- State surfaces: `Callout` (`positive`, `warning`, `destructive`, `neutral`) carries the `border-l-4` edge treatment; `ProgressMeter` styles the native progress element explicitly because Chromium ignores `accent-color` on it; `ManagedHeading` moves focus to step headings.
- Copy: counts always go through `countNoun` (`apps/web/src/shared/format/count.ts`) so singular/plural never drifts. The `eyebrow` utility (styles.css) sets small-caps kickers.

## Color semantics

- `primary` (forest green) is the single strong color: primary buttons, correct-answer feedback border.
- `accent` (pale green) backs positive feedback surfaces; `accent-foreground` for positive fine print.
- `destructive` (brick red) means exactly one thing: a wrong answer, a failed operation, or a destructive action. Destructive confirmations use the `destructive` action variant with a distinct label (e.g. "Endgültig löschen"), never a primary button.
- `warning` (pale amber) marks uncertainty, not failure: low-confidence extracted entries, an answer the judge could not grade. Feedback panels encode state with a `border-l-4` edge plus text, never color alone.

## Motion

Motion is currently minimal (none authored). If animation is added, define one shared easing token in the UI package and use it from both CSS and JS.

## Accessibility

WCAG 2.2 AA is a hard gate: the Playwright + Axe harness in `apps/web/a11y/` renders production components against the real stylesheet and fails on any violation across all routes and interaction states.
