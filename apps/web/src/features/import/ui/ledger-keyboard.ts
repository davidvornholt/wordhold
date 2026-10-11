import type { KeyboardEvent } from 'react';

// Each ledger field names its column, so Enter can move down that column
// like a pen moving to the next line.
export const ledgerFieldAttribute = 'data-ledger-field';

export type LedgerField =
  | 'target'
  | 'native'
  | 'example'
  | 'exampleNative'
  | 'synonyms'
  | 'antonyms';

export const ledgerField = (field: LedgerField) => ({
  [ledgerFieldAttribute]: field,
});

const isTextField = (
  element: EventTarget,
): element is HTMLInputElement | HTMLTextAreaElement =>
  element instanceof HTMLTextAreaElement ||
  (element instanceof HTMLInputElement && element.type === 'text');

const sameColumn = (
  form: HTMLFormElement,
  field: string,
): ReadonlyArray<HTMLElement> =>
  Array.from(
    form.querySelectorAll<HTMLElement>(`[${ledgerFieldAttribute}="${field}"]`),
  );

// Enter on a long review page must never import it by accident, so plain
// Enter moves through the ledger instead of submitting: down a column, or
// up with Shift. Ctrl+Enter or Cmd+Enter imports deliberately.
export const handleLedgerKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
  if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
    return;
  }
  const form = event.currentTarget;
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    form.requestSubmit();
    return;
  }
  const { target } = event;
  if (target instanceof HTMLInputElement && target.type === 'checkbox') {
    // Checkboxes use Space to toggle; Enter must not implicitly submit.
    event.preventDefault();
    return;
  }
  if (!isTextField(target) || event.altKey) {
    return;
  }
  event.preventDefault();
  const field = target.getAttribute(ledgerFieldAttribute);
  if (field === null) {
    return;
  }
  const column = sameColumn(form, field);
  const next = column[column.indexOf(target) + (event.shiftKey ? -1 : 1)];
  next?.focus();
};
