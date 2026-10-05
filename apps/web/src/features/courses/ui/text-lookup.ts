import { useState } from 'react';

// A looked-up text under its title as the source writes it, such as
// "Johannes 3,16" for "joh 3,16".
export type FoundText = {
  readonly title: string;
  readonly text: string;
};

// A Bible a title can be looked up in, by the name the learner knows it by.
export type TextSource = {
  readonly id: string;
  readonly label: string;
};

// Looking up a text by its title, such as a Bible reference.
export type TextLookup = {
  readonly sources: ReadonlyArray<TextSource>;
  readonly lookUp: (title: string, sourceId: string) => Promise<FoundText>;
};

// The Bible a title is looked up in: the one picked, or else the first, so
// a removed Bible falls back to another.
export const useTextSource = (lookup: TextLookup | null) => {
  const [picked, setPicked] = useState<string | null>(null);
  const sources = lookup?.sources ?? [];
  const source = sources.find(({ id }) => id === picked) ?? sources[0] ?? null;
  return { sources, source, pick: setPicked } as const;
};
