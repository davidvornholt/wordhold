export const requireString = (input: unknown): string => {
  if (typeof input !== 'string') {
    throw new Error('Ungültige Eingabe.');
  }
  return input;
};
