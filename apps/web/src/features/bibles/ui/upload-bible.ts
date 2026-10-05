import type { BibleSummary } from '../schemas/bible-models';

// The module goes to the upload route as the request body. A refused upload
// answers with the reason, which is shown as it is.
export const uploadBible = async (file: File): Promise<BibleSummary> => {
  const response = await fetch('/api/bibles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const reason =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : 'Die Bibel wurde nicht hochgeladen. Versuche es noch einmal.';
    throw new Error(reason);
  }
  return body as BibleSummary;
};
