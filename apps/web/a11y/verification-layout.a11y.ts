import { expect, test } from '@playwright/test';

type LayoutBounds = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

type BoundsLocator = {
  readonly boundingBox: () => Promise<LayoutBounds | null>;
};

const mobileViewportWidth = 375;
const beforeWideBreakpoint = 1023;
const afterReaderBreakpoint = 1024;
const wideBreakpoint = 1280;
const viewportHeight = 900;
const minimumPaneGap = 23;
const minimumWidePaneWidth = 580;
const expectedEntryCount = 12;
const layoutTolerance = 1;

const box = async (locator: BoundsLocator): Promise<LayoutBounds> => {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  if (bounds === null) {
    throw new Error('Expected the verification pane to have layout bounds.');
  }
  return bounds;
};

test('the mobile verification workbench stays inside the viewport', async ({
  page,
}) => {
  await page.setViewportSize({
    width: mobileViewportWidth,
    height: viewportHeight,
  });
  await page.goto('/?state=verification');

  const imageBounds = await box(page.locator('.verification-image-pane'));
  const formBounds = await box(page.locator('.verification-form-pane'));
  expect(formBounds.y).toBeGreaterThanOrEqual(
    imageBounds.y + imageBounds.height + minimumPaneGap,
  );
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const addBounds = await box(
    page.getByRole('button', { name: 'Eintrag hinzufügen' }),
  );
  const importBounds = await box(
    page.getByRole('button', { name: '12 Einträge importieren' }),
  );
  expect(addBounds.x + addBounds.width).toBeLessThanOrEqual(
    formBounds.x + formBounds.width + layoutTolerance,
  );
  expect(importBounds.x + importBounds.width).toBeLessThanOrEqual(
    formBounds.x + formBounds.width + layoutTolerance,
  );
});

test('the photograph does not shrink between 1023 and 1024 pixels', async ({
  page,
}) => {
  const inspectStackedWorkbench = async (width: number) => {
    await page.setViewportSize({ width, height: viewportHeight });
    await page.goto('/?state=verification');
    const imageBounds = await box(page.locator('.verification-image-pane'));
    const formBounds = await box(page.locator('.verification-form-pane'));
    expect(formBounds.y).toBeGreaterThanOrEqual(
      imageBounds.y + imageBounds.height + minimumPaneGap,
    );
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth ===
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    return imageBounds.width;
  };

  const widthBefore = await inspectStackedWorkbench(beforeWideBreakpoint);
  const widthAfter = await inspectStackedWorkbench(afterReaderBreakpoint);
  expect(Math.abs(widthBefore - widthAfter)).toBeLessThanOrEqual(
    layoutTolerance,
  );
});

test('the 1280 pixel workbench gives both panes enough room', async ({
  page,
}) => {
  await page.setViewportSize({ width: wideBreakpoint, height: viewportHeight });
  await page.goto('/?state=verification');

  const imageBounds = await box(page.locator('.verification-image-pane'));
  const formBounds = await box(page.locator('.verification-form-pane'));
  expect(formBounds.x).toBeGreaterThanOrEqual(
    imageBounds.x + imageBounds.width + minimumPaneGap,
  );
  expect(imageBounds.width).toBeGreaterThanOrEqual(minimumWidePaneWidth);
  expect(formBounds.width).toBeGreaterThanOrEqual(minimumWidePaneWidth);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth ===
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test('the verification fixture represents a dense photographed page', async ({
  page,
}) => {
  await page.goto('/?state=verification');

  await expect(page.locator('form > ul > li')).toHaveCount(expectedEntryCount);
  await expect(page.getByText('unsicher gelesen')).toHaveCount(1);
  const imageBounds = await box(
    page.getByRole('img', { name: 'Fotografierte Vokabelseite' }),
  );
  expect(imageBounds.height).toBeGreaterThan(imageBounds.width);
});
