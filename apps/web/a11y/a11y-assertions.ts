import type { AccessibilityViolation } from '@davidvornholt/a11y-testing/axe';
// biome-ignore lint/correctness/noUnresolvedImports: @playwright/test re-exports Locator through playwright/test, a chain Biome does not follow.
import type { Locator, Page } from '@playwright/test';

export const assertNoAccessibilityViolations = (
  violations: ReadonlyArray<AccessibilityViolation>,
): void => {
  if (violations.length === 0) {
    return;
  }
  throw new Error(
    violations
      .map(
        (violation) =>
          `${violation.id}: ${violation.help} (${violation.nodes.join(', ')})`,
      )
      .join('\n'),
  );
};

// The WCAG contrast of a field's placeholder against the surface behind it.
// axe skips placeholders, so it is measured here. A canvas turns any CSS
// color into sRGB, and a translucent placeholder is laid over the first
// opaque background among the field's ancestors.
export const placeholderContrast = (field: Locator): Promise<number> =>
  field.evaluate((element) => {
    const context = document
      .createElement('canvas')
      .getContext('2d', { willReadFrequently: true });
    if (context === null) {
      throw new Error('The browser has no 2D canvas.');
    }
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(
        0,
        0,
        1,
        1,
      ).data;
      return { channels: [red, green, blue], alpha: alpha / 255 };
    };
    let surface: Element = element;
    let background = rgba(getComputedStyle(surface).backgroundColor);
    while (background.alpha < 1 && surface.parentElement !== null) {
      surface = surface.parentElement;
      background = rgba(getComputedStyle(surface).backgroundColor);
    }
    const text = rgba(getComputedStyle(element, '::placeholder').color);
    const luminance = (channels: ReadonlyArray<number>) => {
      const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.039_28
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const laid = text.channels.map(
      (channel, index) =>
        text.alpha * channel +
        (1 - text.alpha) * (background.channels[index] ?? 0),
    );
    const [lighter, darker] = [
      luminance(laid),
      luminance(background.channels),
    ].sort((first, second) => second - first);
    return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
  });

// Every edge drawn in the --input color on the page, with its WCAG contrast
// against the colors on either side of it: the control's own fill, when it
// has one, and the first opaque background among its ancestors. That edge is
// often a control's only outline, so WCAG 1.4.11 asks for 3:1, and axe does
// not check it. Disabled controls are exempt.
export const inputEdgeContrasts = (
  page: Page,
): Promise<
  ReadonlyArray<{ readonly control: string; readonly contrast: number }>
> =>
  page.evaluate(() => {
    const context = document
      .createElement('canvas')
      .getContext('2d', { willReadFrequently: true });
    if (context === null) {
      throw new Error('The browser has no 2D canvas.');
    }
    const rgba = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(
        0,
        0,
        1,
        1,
      ).data;
      return { channels: [red, green, blue], alpha: alpha / 255 };
    };
    const luminance = (channels: ReadonlyArray<number>) => {
      const [red = 0, green = 0, blue = 0] = channels.map((channel) => {
        const value = channel / 255;
        return value <= 0.039_28
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const contrast = (
      first: ReadonlyArray<number>,
      second: ReadonlyArray<number>,
    ) => {
      const [lighter = 0, darker = 0] = [
        luminance(first),
        luminance(second),
      ].sort((one, other) => other - one);
      return (lighter + 0.05) / (darker + 0.05);
    };
    const probe = document.createElement('div');
    probe.style.color = 'var(--input)';
    document.body.append(probe);
    const inputColor = getComputedStyle(probe).color;
    probe.remove();
    const edge = rgba(inputColor).channels;
    const sides = ['top', 'right', 'bottom', 'left'] as const;
    const drawsInputEdge = (element: Element) => {
      const style = getComputedStyle(element);
      return (
        sides.some(
          (side) =>
            style.getPropertyValue(`border-${side}-style`) !== 'none' &&
            Number.parseFloat(style.getPropertyValue(`border-${side}-width`)) >
              0 &&
            style.getPropertyValue(`border-${side}-color`) === inputColor,
        ) &&
        !element.matches(':disabled, [aria-disabled="true"]') &&
        element.getClientRects().length > 0
      );
    };
    const surfaceBehind = (element: Element) => {
      let surface = element.parentElement;
      let behind = rgba('transparent');
      while (surface !== null && behind.alpha < 1) {
        behind = rgba(getComputedStyle(surface).backgroundColor);
        surface = surface.parentElement;
      }
      return behind;
    };
    const controlName = (element: Element) =>
      [
        element.tagName.toLowerCase(),
        element.getAttribute('aria-label') ||
          element.getAttribute('name') ||
          element.textContent?.trim().slice(0, 40),
      ]
        .filter(Boolean)
        .join(' ');
    return [...document.body.querySelectorAll('*')]
      .filter(drawsInputEdge)
      .map((element) => {
        const fill = rgba(getComputedStyle(element).backgroundColor);
        const behind = surfaceBehind(element);
        const neighbours = fill.alpha < 1 ? [behind] : [behind, fill];
        return {
          control: controlName(element),
          contrast: Math.min(
            ...neighbours.map((neighbour) =>
              contrast(edge, neighbour.channels),
            ),
          ),
        };
      });
  });
