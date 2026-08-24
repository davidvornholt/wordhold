import { describe, expect, it } from 'bun:test';
import { listOrSeedCourses } from './course-seeding';

describe('listOrSeedCourses', () => {
  it('inserts the seed set once under concurrent first reads', async () => {
    const courses: Array<string> = [];
    let insertCalls = 0;
    let queued = Promise.resolve();
    const withCriticalSection = async (
      work: (store: {
        list: () => Promise<ReadonlyArray<string>>;
        insertSeeds: () => Promise<ReadonlyArray<string>>;
      }) => Promise<ReadonlyArray<string>>,
    ) => {
      const predecessor = queued;
      let release: () => void = () => undefined;
      queued = new Promise<void>((resolve) => {
        release = resolve;
      });
      await predecessor;
      try {
        return await work({
          list: () => Promise.resolve([...courses]),
          insertSeeds: () => {
            insertCalls += 1;
            courses.push('Englisch', 'Französisch', 'Spanisch');
            return Promise.resolve([...courses]);
          },
        });
      } finally {
        release();
      }
    };

    const [first, second] = await Promise.all([
      listOrSeedCourses({ withCriticalSection }),
      listOrSeedCourses({ withCriticalSection }),
    ]);
    expect(insertCalls).toBe(1);
    expect(first).toEqual(courses);
    expect(second).toEqual(courses);
  });
});
