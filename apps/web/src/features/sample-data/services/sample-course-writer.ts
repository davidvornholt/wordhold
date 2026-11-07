import type { Database } from '@wordhold/db/client';
import { Effect } from 'effect';
import type { SampleCourse } from '../content/sample-models';
import { insertedId, writeSampleEntries } from './sample-entries';
import { writeSampleProgress } from './sample-progress';

export type WrittenCourse = {
  readonly entries: number;
  readonly answers: number;
};

const uuidArray = (ids: ReadonlyArray<string>) => `{${ids.join(',')}}`;

// Writes one course with its books, units, entries and practice history.
// Entries are listed by when they were added, so they are dated one second
// apart in the order the sample gives them.
export const writeSampleCourse = (
  sql: Database,
  input: {
    readonly ownerId: string;
    readonly course: SampleCourse;
    readonly createdAt: Date;
    readonly now: Date;
  },
) =>
  Effect.gen(function* () {
    const { course } = input;
    const language = course.kind === 'language';
    const courseId = yield* insertedId(
      'course',
      yield* sql<{ readonly id: string }>`
        insert into courses (owner_id, name, kind, target_language,
          native_language, directions, practises_related_words, created_at)
        values (${input.ownerId}, ${course.name}, ${course.kind},
          ${language ? course.targetLanguage : 'de'}, 'de',
          ${language ? '{to_target,to_native}' : '{to_native}'},
          ${language ? course.practisesRelatedWords : true}, ${input.createdAt})
        returning id
      `,
    );
    const entries = yield* writeSampleEntries(sql, courseId, course);
    if (entries.length === 0) {
      return { entries: 0, answers: 0 } satisfies WrittenCourse;
    }
    yield* sql`
      update entries e set created_at = ${input.createdAt}::timestamptz
        + make_interval(secs => v.position)
      from unnest(${uuidArray(entries.map((entry) => entry.id))}::uuid[])
        with ordinality as v(id, position)
      where e.id = v.id
    `;
    const answers = yield* writeSampleProgress(sql, entries, input.now);
    return { entries: entries.length, answers } satisfies WrittenCourse;
  });
