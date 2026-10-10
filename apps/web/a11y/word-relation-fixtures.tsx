import { useState } from 'react';
import type { SuggestedWordRelations } from '../src/features/courses/schemas/word-relations';
import type { RelationWord } from '../src/features/courses/ui/word-relation-drafts';
import { WordRelationReview } from '../src/features/courses/ui/word-relation-review';
import { PageLayout } from '../src/shared/ui/page-layout';
import { mixedUnit } from './course-fixture-data';
import { fixtureBackControl } from './fixture-controls';

const relationWord = (
  index: number,
  targetText: string,
  nativeText: string,
  lists: Pick<RelationWord, 'synonyms' | 'antonyms'>,
): RelationWord => ({
  id: `00000000-0000-4000-8000-${String(400 + index).padStart(12, '0')}`,
  targetText,
  nativeText,
  ...lists,
});

// Nothing settled for the first word; the page printed a synonym for the
// second; the third is settled with none.
const initialWords = [
  relationWord(1, 'hostile', 'feindselig', { synonyms: null, antonyms: null }),
  relationWord(2, 'brave', 'mutig', {
    synonyms: ['courageous'],
    antonyms: null,
  }),
  relationWord(3, 'holiday', 'die Ferien', { synonyms: [], antonyms: [] }),
];

const suggestions: Readonly<
  Record<string, Omit<SuggestedWordRelations, 'entryId'>>
> = {
  hostile: { synonyms: ['unfriendly', 'aggressive'], antonyms: ['friendly'] },
  brave: { synonyms: ['bold'], antonyms: ['cowardly'] },
};

export const WordRelationFixture = () => {
  const [words, setWords] = useState(initialWords);
  return (
    <PageLayout
      backControl={fixtureBackControl(mixedUnit.name, 'unit')}
      title={`${mixedUnit.name} · Synonyme und Gegenteile`}
    >
      <WordRelationReview
        onSaved={() => Promise.resolve()}
        save={(changes) => {
          setWords((current) =>
            current.map((word) => {
              const change = changes.find(({ entryId }) => entryId === word.id);
              return change === undefined
                ? word
                : {
                    ...word,
                    synonyms: change.synonyms,
                    antonyms: change.antonyms,
                  };
            }),
          );
          return Promise.resolve();
        }}
        suggest={(entryIds) =>
          Promise.resolve(
            words.flatMap((word) => {
              const suggestion = suggestions[word.targetText];
              return entryIds.includes(word.id) && suggestion !== undefined
                ? [{ entryId: word.id, ...suggestion }]
                : [];
            }),
          )
        }
        targetLanguage="en"
        words={words}
      />
    </PageLayout>
  );
};
