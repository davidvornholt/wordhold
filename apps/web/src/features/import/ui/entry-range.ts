// Names a run of rows by their entry numbers, counting from one.
export const entryRange = (start: number, end: number): string =>
  end - start === 1 ? `Eintrag ${start + 1}` : `Einträge ${start + 1}–${end}`;
