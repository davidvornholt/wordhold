import { WordRelations } from '@wordhold/ai/relations';
import type { AiUsage } from '@wordhold/ai/usage';
import { Context, Effect, Layer } from 'effect';
import { englishNames } from '../../../shared/languages';
import { distinctRelatedWords } from '../../../shared/vocabulary/related-words';
import {
  type CourseDatabaseError,
  type CourseKindMismatchError,
  WordRelationSuggestionError,
} from '../errors/courses-errors';
import type {
  SaveWordRelationsData,
  SuggestedWordRelations,
  WordRelationRequestData,
} from '../schemas/word-relations';
import { WordRelationStore } from './word-relation-store';

export class WordRelationService extends Context.Service<
  WordRelationService,
  {
    // Suggestions for the review screen; nothing is stored. A word that is
    // gone is left out.
    readonly suggest: (
      input: WordRelationRequestData,
    ) => Effect.Effect<
      ReadonlyArray<SuggestedWordRelations>,
      CourseDatabaseError | WordRelationSuggestionError,
      AiUsage
    >;
    readonly save: (
      input: SaveWordRelationsData,
    ) => Effect.Effect<number, CourseDatabaseError | CourseKindMismatchError>;
  }
>()('wordhold/WordRelationService') {
  static readonly layer = Layer.effect(
    WordRelationService,
    Effect.gen(function* () {
      const store = yield* WordRelationStore;
      const relations = yield* WordRelations;

      const suggest = ({ courseId, entryIds }: WordRelationRequestData) =>
        Effect.gen(function* () {
          const stored = yield* store.read(courseId, entryIds);
          // In the order asked, so the screen fills its rows top to bottom.
          const words = entryIds.flatMap((entryId) =>
            stored.filter((word) => word.entryId === entryId),
          );
          const [first] = words;
          if (first === undefined) {
            return [];
          }
          const suggestions = yield* relations
            .suggest({
              targetLanguage: englishNames[first.targetLanguage],
              words,
            })
            .pipe(
              Effect.mapError(
                () =>
                  new WordRelationSuggestionError({
                    message:
                      'Die Synonyme und Gegenteile konnten nicht vorgeschlagen werden.',
                  }),
              ),
            );
          return words.map((word, index) => {
            const suggestion = suggestions.words[index];
            return {
              entryId: word.entryId,
              synonyms: distinctRelatedWords(
                suggestion?.synonyms ?? [],
                word.targetText,
              ),
              antonyms: distinctRelatedWords(
                suggestion?.antonyms ?? [],
                word.targetText,
              ),
            } satisfies SuggestedWordRelations;
          });
        });

      return WordRelationService.of({ suggest, save: store.save });
    }),
  );
}
