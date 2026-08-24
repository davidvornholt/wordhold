type CourseSeedStore<Course> = {
  readonly list: () => Promise<ReadonlyArray<Course>>;
  readonly insertSeeds: () => Promise<ReadonlyArray<Course>>;
};

type CourseSeedDependencies<Course> = {
  readonly withCriticalSection: (
    work: (store: CourseSeedStore<Course>) => Promise<ReadonlyArray<Course>>,
  ) => Promise<ReadonlyArray<Course>>;
};

export const listOrSeedCourses = async <Course>(
  dependencies: CourseSeedDependencies<Course>,
): Promise<ReadonlyArray<Course>> =>
  dependencies.withCriticalSection(async (store) => {
    const existing = await store.list();
    return existing.length > 0 ? existing : store.insertSeeds();
  });
