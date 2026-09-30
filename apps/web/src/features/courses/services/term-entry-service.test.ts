import { describe, expect, it } from 'bun:test';
import { DefinitionError } from '@wordhold/ai/definition/error';
import type {
  DefinitionRequest,
  KeyPointRequest,
} from '@wordhold/ai/definition/schema';
import { DefinitionWriter } from '@wordhold/ai/definition/writer';
import { Effect, Layer } from 'effect';
import { TermEntryService } from './term-entry-service';
import {
  type CreateTermEntryResult,
  type StoredTerm,
  type TermCourse,
  TermEntryStore,
  type UpdateTermEntryResult,
} from './term-entry-store';

const courseId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const entryId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

const definition = 'Ein Stoff, der die Aktivierungsenergie senkt.';
const derived = ['senkt die Aktivierungsenergie'];

type Stubs = {
  readonly createResult?: CreateTermEntryResult;
  readonly updateResult?: UpdateTermEntryResult;
  // Null for a course that does not exist.
  readonly course?: TermCourse | null;
  readonly stored?: StoredTerm;
  readonly termKnown?: boolean;
  // What the store holds after saving derived key points.
  readonly saved?: ReadonlyArray<string> | null;
  readonly writerFails?: boolean;
};

const subject: TermCourse = { kind: 'terms', name: 'Chemie' };

const runService = <A, E>(
  use: (service: TermEntryService) => Effect.Effect<A, E>,
  {
    createResult = { kind: 'created', entryId },
    updateResult = { kind: 'updated', definitionChanged: true },
    course = subject,
    stored = { term: 'Katalysator', definition, keyPoints: null },
    termKnown = true,
    saved = derived,
    writerFails = false,
  }: Stubs = {},
) => {
  const suggestions: Array<DefinitionRequest> = [];
  const derivations: Array<KeyPointRequest> = [];
  const failure = new DefinitionError({ cause: 'down', message: 'down' });
  const dependencies = Layer.merge(
    Layer.succeed(TermEntryStore, {
      readCourse: () => Effect.succeed(course ?? undefined),
      create: () => Effect.succeed(createResult),
      update: () => Effect.succeed(updateResult),
      readTerm: () => Effect.succeed(termKnown ? stored : undefined),
      saveDerivedKeyPoints: () => Effect.succeed(saved),
      setKeyPoints: () => Effect.succeed(termKnown),
    }),
    Layer.succeed(
      DefinitionWriter,
      DefinitionWriter.make({
        suggest: (request) => {
          suggestions.push(request);
          return writerFails
            ? Effect.fail(failure)
            : Effect.succeed({ definition });
        },
        keyPoints: (request) => {
          derivations.push(request);
          return writerFails
            ? Effect.fail(failure)
            : Effect.succeed({ keyPoints: derived });
        },
      }),
    ),
  );
  return Effect.runPromise(
    Effect.flatMap(TermEntryService, use).pipe(
      Effect.provide(
        TermEntryService.Default.pipe(Layer.provide(dependencies)),
      ),
      Effect.either,
      Effect.map((result) => ({ result, suggestions, derivations })),
    ),
  );
};

const failureTag = (result: {
  readonly _tag: string;
  readonly left?: unknown;
}) =>
  result._tag === 'Left' &&
  typeof result.left === 'object' &&
  result.left !== null &&
  '_tag' in result.left
    ? result.left._tag
    : undefined;

const input = {
  courseId,
  term: 'Katalysator',
  definition,
};

describe('TermEntryService', () => {
  it('names each refused term as a typed failure', async () => {
    const created = await runService((service) => service.create(input));
    expect(created.result).toEqual(
      expect.objectContaining({ right: { entryId } }),
    );
    const cases = [
      [{ kind: 'duplicate' }, 'VocabularyEntryConflictError'],
      [{ kind: 'course-missing' }, 'CourseSettingsNotFoundError'],
      [{ kind: 'not-terms' }, 'CourseKindMismatchError'],
    ] as const;
    const refused = await Promise.all(
      cases.map(([createResult]) =>
        runService((service) => service.create(input), { createResult }),
      ),
    );
    expect(refused.map(({ result }) => failureTag(result))).toEqual(
      cases.map(([, tag]) => tag),
    );
  });

  it('suggests a definition with the subject as context', async () => {
    const request = { courseId, term: 'Base' };
    const { result, suggestions } = await runService((service) =>
      service.suggestDefinition(request),
    );
    expect(result).toEqual(expect.objectContaining({ right: { definition } }));
    expect(suggestions).toEqual([{ term: 'Base', subject: 'Chemie' }]);
    const failed = await runService(
      (service) => service.suggestDefinition(request),
      { writerFails: true },
    );
    expect(failureTag(failed.result)).toBe('TermAssistError');
    const refused = await Promise.all(
      [{ ...subject, kind: 'language' } as const, null].map((course) =>
        runService((service) => service.suggestDefinition(request), {
          course,
        }),
      ),
    );
    expect(refused.map((refusal) => failureTag(refusal.result))).toEqual([
      'CourseKindMismatchError',
      'CourseSettingsNotFoundError',
    ]);
    expect(refused.flatMap(({ suggestions: asked }) => asked)).toEqual([]);
  });

  it('derives key points once and keeps the ones stored first', async () => {
    const fresh = await runService((service) =>
      service.deriveKeyPoints({ courseId, entryId }),
    );
    expect(fresh.result).toEqual(
      expect.objectContaining({ right: { keyPoints: derived } }),
    );
    expect(fresh.derivations).toEqual([{ term: 'Katalysator', definition }]);
    const existing = ['wird nicht verbraucht'];
    const known = await runService(
      (service) => service.deriveKeyPoints({ courseId, entryId }),
      { stored: { term: 'Katalysator', definition, keyPoints: existing } },
    );
    expect(known.result).toEqual(
      expect.objectContaining({ right: { keyPoints: existing } }),
    );
    expect(known.derivations).toEqual([]);
    const raced = await runService(
      (service) => service.deriveKeyPoints({ courseId, entryId }),
      { saved: existing },
    );
    expect(raced.result).toEqual(
      expect.objectContaining({ right: { keyPoints: existing } }),
    );
    const failed = await runService(
      (service) => service.deriveKeyPoints({ courseId, entryId }),
      { writerFails: true },
    );
    expect(failureTag(failed.result)).toBe('TermAssistError');
    const missing = await runService(
      (service) => service.deriveKeyPoints({ courseId, entryId }),
      { termKnown: false },
    );
    expect(failureTag(missing.result)).toBe('VocabularyEntryNotFoundError');
  });

  it('refuses to edit the key points of a missing term', async () => {
    const edited = await runService((service) =>
      service.updateKeyPoints({ courseId, entryId, keyPoints: derived }),
    );
    expect(edited.result).toEqual(
      expect.objectContaining({ right: { keyPoints: derived } }),
    );
    const missing = await runService(
      (service) =>
        service.updateKeyPoints({ courseId, entryId, keyPoints: derived }),
      { termKnown: false },
    );
    expect(failureTag(missing.result)).toBe('VocabularyEntryNotFoundError');
  });
});

describe('TermEntryService edits', () => {
  it('reports a changed definition and names each refused edit', async () => {
    const edit = { ...input, entryId };
    const edited = await runService((service) => service.update(edit));
    expect(edited.result).toEqual(
      expect.objectContaining({ right: { definitionChanged: true } }),
    );
    const cases = [
      [{ kind: 'duplicate' }, 'VocabularyEntryConflictError'],
      [{ kind: 'term-missing' }, 'VocabularyEntryNotFoundError'],
    ] as const;
    const refused = await Promise.all(
      cases.map(([updateResult]) =>
        runService((service) => service.update(edit), { updateResult }),
      ),
    );
    expect(refused.map(({ result }) => failureTag(result))).toEqual(
      cases.map(([, tag]) => tag),
    );
  });
});
