export const sessionSectionSize = 20;

export const itemsInNextSection = (remaining: number): number =>
  Math.min(sessionSectionSize, remaining);
