import { useState } from 'react';
import type { BibleSummary } from '../src/features/bibles/schemas/bible-models';
import { BibleLibrary } from '../src/features/bibles/ui/bible-library';
import { fixtureBible } from './bible-fixture-data';

const moduleExtension = /\.bbl\.mybible$/u;

// Uploads and removals change the list in memory, the way the page's
// refreshed loader would show them. A file not named like a MySword Bible
// is refused as the server refuses a file that is not one.
export const FixtureBibleLibrary = () => {
  const [bibles, setBibles] = useState<ReadonlyArray<BibleSummary>>([
    fixtureBible,
  ]);
  const upload = (file: File) =>
    new Promise<BibleSummary>((resolve) => {
      if (!moduleExtension.test(file.name)) {
        throw new Error(
          'Die Datei ist keine MySword-Bibel. Lade eine Datei hoch, deren Name auf „.bbl.mybible“ endet.',
        );
      }
      const abbreviation = file.name.replace(moduleExtension, '');
      const bible = {
        id: crypto.randomUUID(),
        name: abbreviation,
        abbreviation,
        verseCount: 31_102,
      };
      setBibles((current) => [...current, bible]);
      resolve(bible);
    });
  const remove = (bibleId: string) => {
    setBibles((current) => current.filter(({ id }) => id !== bibleId));
    return Promise.resolve();
  };
  return <BibleLibrary bibles={bibles} remove={remove} upload={upload} />;
};
