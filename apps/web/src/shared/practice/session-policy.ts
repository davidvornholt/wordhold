import { itemsInNextSection } from '../session/section-policy';

export const readyCardsInNextSection = (
  due: number,
  firstReviews: number,
): number => itemsInNextSection(due + firstReviews);
