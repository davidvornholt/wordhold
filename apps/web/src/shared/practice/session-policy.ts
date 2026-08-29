export const practiceSectionSize = 20;

export const readyCardsInNextSection = (
  due: number,
  firstReviews: number,
): number => Math.min(practiceSectionSize, due + firstReviews);
