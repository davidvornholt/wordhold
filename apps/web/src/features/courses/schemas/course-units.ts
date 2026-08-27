// A unit as the course's unit lists offer it. The learning list opens the ones
// that still hold unmet words; the drill list opens the ones that hold words
// already learned. Both need the same two counts, so the unit belongs to the
// course rather than to either screen.
export type CourseUnit = {
  readonly id: string;
  readonly name: string;
  readonly words: number;
  readonly unlearned: number;
};

// How many of the unit's words have been through the learning pass, which is
// what a drill of the unit would ask about.
export const learnedWords = (unit: CourseUnit): number =>
  unit.words - unit.unlearned;
