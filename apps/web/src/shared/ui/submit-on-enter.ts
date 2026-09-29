import type { KeyboardEvent } from 'react';

// Enter submits a multi-line field's form, as the browser does for a one-line
// field; Shift+Enter starts a new line. requestSubmit ignores a disabled
// submit button, so the button is checked here, as the browser does.
export const submitOnEnter = (event: KeyboardEvent<HTMLTextAreaElement>) => {
  if (
    event.key !== 'Enter' ||
    event.shiftKey ||
    event.nativeEvent.isComposing
  ) {
    return;
  }
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
