import type { SpellingPitfall } from '@wordhold/ai/pitfalls/schema';
import type { Database } from '@wordhold/db/client';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import { Effect } from 'effect';
import { normalizeAnswer } from '../../../shared/grading/normalize';
import {
  type GradeOutcome,
  gradeRecitation,
} from '../../../shared/grading/rating';
import { insertVocabularyEntries } from '../../../shared/vocabulary/insert-entries';
import type { Progress } from '../content/sample-histories';
import type {
  SampleCourse,
  SampleTerm,
  SampleText,
  SampleWord,
} from '../content/sample-models';
import { SampleDataError } from '../errors/sample-data-errors';

// What a correct answer to one of an entry's cards looks like.
type CorrectAnswer = {
  readonly answer: string;
  readonly outcome: GradeOutcome;
};

// An inserted entry with what its practice history needs to know.
export type WrittenEntry = {
  readonly id: string;
  readonly progress: Progress;
  readonly ratesEasy: boolean;
  readonly correct: (direction: AnswerDirection) => CorrectAnswer;
};

const textArray = (texts: ReadonlyArray<string>) => JSON.stringify(texts);

export const insertedId = (
  what: string,
  rows: ReadonlyArray<{ readonly id: string }>,
) => {
  const [row] = rows;
  return row === undefined
    ? Effect.fail(
        new SampleDataError({
          cause: undefined,
          message: `The sample ${what} was not inserted.`,
        }),
      )
    : Effect.succeed(row.id);
};

const pitfallOf = (sample: SampleWord): ReadonlyArray<SpellingPitfall> => {
  if (sample.pitfall === undefined) {
    return [];
  }
  const at = sample.target.indexOf(sample.pitfall.tricky);
  const end = at + sample.pitfall.tricky.length;
  return [
    {
      segments: [
        { text: sample.target.slice(0, at), tricky: false },
        { text: sample.pitfall.tricky, tricky: true },
        { text: sample.target.slice(end), tricky: false },
      ].filter((segment) => segment.text !== ''),
      note: sample.pitfall.note,
    },
  ];
};

const wordAnswer = (sample: SampleWord, direction: AnswerDirection) => {
  switch (direction) {
    case 'to_target':
      return sample.target;
    case 'to_native':
      return sample.native;
    case 'to_synonym':
      return sample.related?.synonyms[0] ?? '';
    case 'to_antonym':
      return sample.related?.antonyms[0] ?? '';
    default:
      return direction satisfies never;
  }
};

const termOutcome = (sample: SampleTerm): GradeOutcome => ({
  method: 'definition',
  keyPoints: sample.keyPoints,
  verdict: {
    keyPoints: sample.keyPoints.map(() => ({ covered: true, note: null })),
    accuracy: { ok: true, note: null },
    explanation: null,
  },
});

const writeWords = (
  sql: Database,
  input: {
    readonly courseId: string;
    readonly bookId: string;
    readonly unitId: string | null;
    readonly words: ReadonlyArray<SampleWord>;
  },
) =>
  Effect.gen(function* () {
    const inserted = yield* insertVocabularyEntries(
      sql,
      input.words.map((sample) => ({
        courseId: input.courseId,
        bookId: input.bookId,
        unitId: input.unitId,
        pageId: null,
        targetText: sample.target,
        nativeText: sample.native,
        example:
          sample.example === undefined
            ? undefined
            : {
                targetText: sample.example.target,
                nativeText: sample.example.native,
                source: 'textbook',
              },
        synonyms: sample.related?.synonyms ?? null,
        antonyms: sample.related?.antonyms ?? null,
      })),
    );
    const written: Array<WrittenEntry> = [];
    // Inserted entries come back in the order of the words.
    for (const [index, sample] of input.words.entries()) {
      const id = yield* insertedId('word', inserted.slice(index, index + 1));
      const pitfalls = pitfallOf(sample);
      if (pitfalls.length > 0) {
        yield* sql`update entries
          set spelling_pitfalls = ${JSON.stringify(pitfalls)}::jsonb
          where id = ${id}`;
      }
      written.push({
        id,
        progress: sample.progress,
        ratesEasy: true,
        correct: (direction) => ({
          answer: wordAnswer(sample, direction),
          outcome: { method: 'exact' },
        }),
      });
    }
    return written;
  });

// A term is asked from term to definition only, with the definition as its
// one accepted answer, as a typed term is.
const writeTerm = (
  sql: Database,
  input: { readonly courseId: string; readonly bookId: string },
  sample: SampleTerm,
) =>
  Effect.gen(function* () {
    const entryId = yield* insertedId(
      'term',
      yield* sql<{ readonly id: string }>`
        insert into entries (course_id, book_id, target_text, native_text,
          key_points)
        values (${input.courseId}, ${input.bookId}, ${sample.term},
          ${sample.definition}, array(select jsonb_array_elements_text(
            ${textArray(sample.keyPoints)}::jsonb)))
        returning id
      `,
    );
    yield* sql`
      insert into accepted_answers (entry_id, direction, text, normalized, source)
      values (${entryId}, 'to_native', ${sample.definition},
        ${normalizeAnswer(sample.definition)}, 'textbook')
    `;
    yield* sql`insert into cards (entry_id, direction)
      values (${entryId}, 'to_native')`;
    return {
      id: entryId,
      progress: sample.progress,
      ratesEasy: false,
      correct: () => ({
        answer: sample.definition,
        outcome: termOutcome(sample),
      }),
    } satisfies WrittenEntry;
  });

// A text is recited, so it has no accepted answers to match against.
const writeText = (
  sql: Database,
  input: { readonly courseId: string; readonly bookId: string },
  sample: SampleText,
) =>
  Effect.gen(function* () {
    const entryId = yield* insertedId(
      'text',
      yield* sql<{ readonly id: string }>`
        insert into entries (course_id, book_id, target_text, native_text)
        values (${input.courseId}, ${input.bookId}, ${sample.title},
          ${sample.text})
        returning id
      `,
    );
    yield* sql`insert into cards (entry_id, direction)
      values (${entryId}, 'to_native')`;
    return {
      id: entryId,
      progress: sample.progress,
      ratesEasy: false,
      correct: () => ({
        answer: sample.text,
        outcome: gradeRecitation(sample.text, sample.text, {
          dictated: false,
        }),
      }),
    } satisfies WrittenEntry;
  });

const insertBook = (
  sql: Database,
  courseId: string,
  name: string,
  position: number,
) =>
  sql<{ readonly id: string }>`
    insert into books (course_id, name, position)
    values (${courseId}, ${name}, ${position})
    returning id
  `.pipe(Effect.flatMap((rows) => insertedId('book', rows)));

const writeLanguageBooks = (
  sql: Database,
  courseId: string,
  course: Extract<SampleCourse, { readonly kind: 'language' }>,
) =>
  Effect.gen(function* () {
    const written: Array<WrittenEntry> = [];
    for (const [position, book] of course.books.entries()) {
      const bookId = yield* insertBook(sql, courseId, book.name, position);
      for (const [unitPosition, unit] of book.units.entries()) {
        const unitId = yield* insertedId(
          'unit',
          yield* sql<{ readonly id: string }>`
            insert into units (course_id, book_id, name, position)
            values (${courseId}, ${bookId}, ${unit.name}, ${unitPosition})
            returning id
          `,
        );
        written.push(
          ...(yield* writeWords(sql, {
            courseId,
            bookId,
            unitId,
            words: unit.words,
          })),
        );
      }
      written.push(
        ...(yield* writeWords(sql, {
          courseId,
          bookId,
          unitId: null,
          words: book.words,
        })),
      );
    }
    return written;
  });

// A subject or collection keeps its entries in the one book it is created
// with, which the learner never sees.
const writeListBook = (
  sql: Database,
  courseId: string,
  course: Exclude<SampleCourse, { readonly kind: 'language' }>,
) =>
  Effect.gen(function* () {
    const bookId = yield* insertBook(sql, courseId, 'Allgemein', 0);
    const input = { courseId, bookId };
    const written: Array<WrittenEntry> = [];
    if (course.kind === 'terms') {
      for (const sample of course.terms) {
        written.push(yield* writeTerm(sql, input, sample));
      }
    } else {
      for (const sample of course.texts) {
        written.push(yield* writeText(sql, input, sample));
      }
    }
    return written;
  });

// Writes a course's books, units and entries in the order the sample lists
// them.
export const writeSampleEntries = (
  sql: Database,
  courseId: string,
  course: SampleCourse,
) =>
  course.kind === 'language'
    ? writeLanguageBooks(sql, courseId, course)
    : writeListBook(sql, courseId, course);
