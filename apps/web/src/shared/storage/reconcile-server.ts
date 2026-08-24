import { entryAudio } from '@wordhold/db/schema/entries';
import { pages } from '@wordhold/db/schema/pages';
import { db } from '../db/server';
import { reconcileDataFiles } from './server';

export const reconcileStoredFiles = async (): Promise<
  ReadonlyArray<string>
> => {
  const [pageReferences, audioReferences] = await Promise.all([
    db.select({ path: pages.imagePath }).from(pages),
    db.select({ path: entryAudio.path }).from(entryAudio),
  ]);
  return reconcileDataFiles(
    new Set([
      ...pageReferences.map((reference) => reference.path),
      ...audioReferences.map((reference) => reference.path),
    ]),
  );
};
