// Renders the PNG app icons in `public` from `public/favicon.svg`. Run it
// after changing the favicon.
// biome-ignore lint/correctness/noUnresolvedImports: @playwright/test re-exports chromium through playwright/test, a chain Biome does not follow.
import { chromium } from '@playwright/test';

const publicDirectory = `${import.meta.dir}/../public`;

// Launchers crop a maskable icon to their own shape and only promise to keep
// the central circle of 80% of its width, so its glyph is drawn smaller.
const icons = [
  { file: 'apple-touch-icon.png', size: 180, glyphScale: 1 },
  { file: 'icon-192.png', size: 192, glyphScale: 1 },
  { file: 'icon-512.png', size: 512, glyphScale: 1 },
  { file: 'icon-maskable-512.png', size: 512, glyphScale: 0.7 },
] as const;

const browser = await chromium.launch();
try {
  await Promise.all(
    icons.map(async (icon) => {
      const page = await browser.newPage();
      await page.goto(`file://${publicDirectory}/favicon.svg`);
      const svg = page.locator('svg');
      await svg.evaluate((element, { size, glyphScale }) => {
        element.setAttribute('width', String(size));
        element.setAttribute('height', String(size));
        // Scales the glyph around the centre of the 32-unit view box.
        element
          .querySelector('path')
          ?.setAttribute(
            'transform',
            `translate(16 16) scale(${glyphScale}) translate(-16 -16)`,
          );
      }, icon);
      await svg.screenshot({ path: `${publicDirectory}/${icon.file}` });
    }),
  );
} finally {
  await browser.close();
}
