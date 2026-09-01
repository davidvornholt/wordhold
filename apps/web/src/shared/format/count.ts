// German count phrases: "1 Karte", "2 Karten". Every user-facing count goes
// through this so no screen ever prints "1 Karten".
export const countNoun = (
  count: number,
  singular: string,
  plural: string,
): string => `${count} ${count === 1 ? singular : plural}`;
