import type { AccessibilityViolation } from '@davidvornholt/a11y-testing/axe';

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
