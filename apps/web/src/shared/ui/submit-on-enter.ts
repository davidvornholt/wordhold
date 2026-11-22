import type { KeyboardEvent } from 'react';

// The keyCode browsers give a key an input method handles.
const inputMethodKeyCode = 229;

// An Enter that picks an input method's candidate writes the word rather than
// sending the answer. Safari reports that Enter after the composition has
// ended, with isComposing false, so only its keyCode gives it away.
const confirmsCandidate = (event: KeyboardEvent<HTMLTextAreaElement>) =>
  event.nativeEvent.isComposing ||
  event.nativeEvent.keyCode === inputMethodKeyCode;

// requestSubmit ignores a disabled submit button, so the button is checked
// here, as the browser does.
const submitForm = (event: KeyboardEvent<HTMLTextAreaElement>) => {
  event.preventDefault();
  const { form } = event.currentTarget;
  const submitter = [...(form?.elements ?? [])].find(
    (element): element is HTMLButtonElement =>
      element instanceof HTMLButtonElement && element.type === 'submit',
  );
  if (submitter?.disabled === true) {
    return;
  }
  form?.requestSubmit(submitter ?? undefined);
};

// Enter submits a multi-line field's form, as the browser does for a one-line
// field; Shift+Enter starts a new line.
export const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
  if (event.key !== 'Enter' || event.shiftKey || confirmsCandidate(event)) {
    return;
  }
  submitForm(event);
};

// A one-line answer that wraps takes no line breaks, so Enter submits it with
// or without Shift, as in a one-line field.
export const submitOnEveryEnter = (
  event: KeyboardEvent<HTMLTextAreaElement>,
) => {
  if (event.key !== 'Enter' || confirmsCandidate(event)) {
    return;
  }
  submitForm(event);
};
