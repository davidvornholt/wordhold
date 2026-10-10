import { describe, expect, it } from 'bun:test';
import { WordRelations } from '@wordhold/ai/relations';
import { RelationError } from '@wordhold/ai/relations/error';
import type { RelationRequest } from '@wordhold/ai/relations/schema';
import { untrackedAiUsage } from '@wordhold/ai/testing/usage';
import { Effect, Layer } from 'effect';
import { WordRelationService } from './word-relation-service';
import {
  type RelationWordContext,
  WordRelationStore,
} from './word-relation-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const hostileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const braveId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const goneId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const word = (
  entryId: string,
  targetText: string,
  nativeText: string,
): RelationWordContext => ({
  entryId,
  targetText,
  nativeText,
  example: null,
  targetLanguage: 'en',
});

const stored = [
  word(braveId, 'brave', 'mutig'),
  word(hostileId, 'hostile', 'feindselig'),
];

const runSuggest = (
  entryIds: ReadonlyArray<string>,
  answer: (request: RelationRequest) => Effect.Effect<
    {
      readonly words: ReadonlyArray<{
        readonly synonyms: ReadonlyArray<string>;
        readonly antonyms: ReadonlyArray<string>;
      }>;
    },
    RelationError
  >,
) =>
  Effect.runPromise(
    Effect.flatMap(WordRelationService, (service) =>
      service.suggest({ courseId, entryIds }),
    ).pipe(
      Effect.provide(
        WordRelationService.layer.pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(WordRelationStore, {
                read: () => Effect.succeed(stored),
                save: () => Effect.succeed(0),
              }),
              Layer.succeed(WordRelations, { suggest: answer }),
            ),
          ),
        ),
      ),
      Effect.provide(untrackedAiUsage),
      Effect.result,
    ),
  );

describe('WordRelationService.suggest', () => {
  it('asks in the requested order and cleans the answer', async () => {
    const requests: Array<RelationRequest> = [];
    const result = await runSuggest([hostileId, goneId, braveId], (request) => {
      requests.push(request);
      return Effect.succeed({
        words: [
          { synonyms: ['unfriendly', 'Unfriendly', 'hostile'], antonyms: [] },
          { synonyms: ['courageous'], antonyms: ['cowardly'] },
        ],
      });
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.targetLanguage).toBe('English');
    expect(requests[0]?.words.map((asked) => asked.targetText)).toEqual([
      'hostile',
      'brave',
    ]);
    expect(result).toMatchObject({
      _tag: 'Success',
      success: [
        { entryId: hostileId, synonyms: ['unfriendly'], antonyms: [] },
        { entryId: braveId, synonyms: ['courageous'], antonyms: ['cowardly'] },
      ],
    });
  });

  it('asks nothing when none of the words is left', async () => {
    let asked = false;
    const result = await runSuggest([goneId], () => {
      asked = true;
      return Effect.succeed({ words: [] });
    });
    expect(asked).toBe(false);
    expect(result).toMatchObject({ _tag: 'Success', success: [] });
  });

  it('reports a failed suggestion in German', async () => {
    const result = await runSuggest([hostileId], () =>
      Effect.fail(new RelationError({ cause: null, message: 'failed' })),
    );
    expect(result).toMatchObject({
      _tag: 'Failure',
      failure: {
        _tag: 'WordRelationSuggestionError',
        message:
          'Die Synonyme und Gegenteile konnten nicht vorgeschlagen werden.',
      },
    });
  });
});
