export const isMissingRecordError = (error: unknown): boolean =>
  error instanceof Error && error.message.endsWith('nicht gefunden.');

export const retryRoute = (reset: () => void): void => {
  reset();
};
