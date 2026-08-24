import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { listOrSeedCourses } from './course-seeding';

describe('listOrSeedCourses', () => {
  it('inserts the seed set once when the caller serializes first reads', async () => {
    const courses: Array<string> = [];
    let insertCalls = 0;
    let queued = Promise.resolve();
    const runSerialized = async () => {
      const predecessor = queued;
      let release: () => void = () => undefined;
      queued = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      try {
        return await Effect.runPromise(
          listOrSeedCourses({
            list: Effect.sync(() => [...courses]),
            insertSeeds: Effect.sync(() => {
              insertCalls += 1;
              courses.push('Englisch', 'Französisch', 'Spanisch');
              return [...courses];
            }),
          }),
        );
      } finally {
        release();
      }
    };

    const [first, second] = await Promise.all([
      runSerialized(),
      runSerialized(),
    ]);
    expect(insertCalls).toBe(1);
    expect(first).toEqual(courses);
    expect(second).toEqual(courses);
  });
});
