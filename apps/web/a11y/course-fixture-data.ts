import type {
  CourseUnit,
  UnitDirectionProgress,
} from '../src/features/courses/schemas/course-units';

export const targetLabel = 'Englisch';

const holidaysCount = 18;
const holidaysReverseIntroduced = 16;
const sportCount = 25;
const schoolCount = 16;

const directionProgress = (
  direction: UnitDirectionProgress['direction'],
  total: number,
  introduced: number,
  overrides: Partial<UnitDirectionProgress> = {},
): UnitDirectionProgress => ({
  direction,
  total,
  introduced,
  unintroduced: total - introduced,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  ...overrides,
});

export const mixedUnit: CourseUnit = {
  id: '00000000-0000-0000-0000-000000000003',
  name: 'Unit 3 – Holidays',
  entries: holidaysCount,
  introduced: holidaysCount,
  unintroduced: 2,
  due: 0,
  firstReviews: 0,
  nextDueAt: new Date('2026-09-01T10:40:00Z'),
  directions: [
    directionProgress('to_target', holidaysCount, holidaysCount),
    directionProgress('to_native', holidaysCount, holidaysReverseIntroduced),
  ],
};

export const unintroducedUnit: CourseUnit = {
  id: '00000000-0000-0000-0000-000000000004',
  name: 'Unit 4 – Sport',
  entries: sportCount,
  introduced: 0,
  unintroduced: sportCount,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  directions: [
    directionProgress('to_target', sportCount, 0),
    directionProgress('to_native', sportCount, 0),
  ],
};

export const finishedUnit: CourseUnit = {
  id: '00000000-0000-0000-0000-000000000002',
  name: 'Unit 2 – School',
  entries: schoolCount,
  introduced: schoolCount,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: new Date('2026-09-01T10:40:00Z'),
  directions: [
    directionProgress('to_target', schoolCount, schoolCount),
    directionProgress('to_native', schoolCount, schoolCount),
  ],
};

export const dueUnit: CourseUnit = {
  ...finishedUnit,
  id: '00000000-0000-0000-0000-000000000006',
  name: 'Unit 6 – Travel',
  due: 1,
  nextDueAt: null,
  directions: [
    directionProgress('to_target', schoolCount, schoolCount, { due: 1 }),
    directionProgress('to_native', schoolCount, schoolCount),
  ],
};

export const emptyUnit: CourseUnit = {
  id: '00000000-0000-0000-0000-000000000005',
  name: 'Unit 5 – Empty',
  entries: 0,
  introduced: 0,
  unintroduced: 0,
  due: 0,
  firstReviews: 0,
  nextDueAt: null,
  directions: [],
};

export const courseUnits: ReadonlyArray<CourseUnit> = [
  mixedUnit,
  unintroducedUnit,
  finishedUnit,
  emptyUnit,
];
