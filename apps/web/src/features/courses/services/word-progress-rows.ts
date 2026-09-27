import type { Database } from '@wordhold/db/client';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { DirectionProgress, WordProgress } from '../schemas/course-units';

type DirectionColumns = {
  readonly toTargetEnabled: boolean;
  readonly toTargetTotal: number;
  readonly toTargetIntroduced: number;
  readonly toTargetUnintroduced: number;
  readonly toTargetDue: number;
  readonly toTargetFirstReviews: number;
  readonly toTargetNextDueAt: Date | null;
  readonly toNativeEnabled: boolean;
  readonly toNativeTotal: number;
  readonly toNativeIntroduced: number;
  readonly toNativeUnintroduced: number;
  readonly toNativeDue: number;
  readonly toNativeFirstReviews: number;
  readonly toNativeNextDueAt: Date | null;
};

export type WordProgressRow<Place> = Place &
  Omit<WordProgress, 'directions'> &
  DirectionColumns;

// The progress columns of a query that groups entries `e` with their `cards`
// by book or unit, joined to the course `co`. An entry remains unintroduced
// while one of the course's enabled directions has not been introduced. A
// disabled direction stays out of the learner's way until it is enabled
// again.
export const wordProgressColumns = (sql: Database, now: Date) => sql`
  count(distinct e.id)::int as entries,
  count(distinct e.id) filter (
    where exists (
      select 1 from cards met
      where met.entry_id = e.id
        and met.introduced_at is not null
    )
  )::int as introduced,
  count(distinct e.id) filter (
    where exists (
      select 1 from cards pending
      where pending.entry_id = e.id
        and pending.direction = any(co.directions)
        and pending.introduced_at is null
    )
  )::int as unintroduced,
  count(cards.id) filter (
    where cards.introduced_at is not null
      and cards.direction = any(co.directions)
      and cards.state <> 'new' and cards.due_at <= ${now}
  )::int as due,
  count(cards.id) filter (
    where cards.introduced_at is not null
      and cards.direction = any(co.directions)
      and cards.state = 'new'
  )::int as "firstReviews",
  min(cards.due_at) filter (
    where cards.introduced_at is not null
      and cards.direction = any(co.directions)
      and cards.due_at > ${now}
  ) as "nextDueAt",
  max(e.created_at) as "lastAddedAt",
  'to_target' = any(co.directions) as "toTargetEnabled",
  count(cards.id) filter (
    where cards.direction = 'to_target'
  )::int as "toTargetTotal",
  count(cards.id) filter (
    where cards.direction = 'to_target'
      and cards.introduced_at is not null
  )::int as "toTargetIntroduced",
  count(cards.id) filter (
    where cards.direction = 'to_target'
      and cards.introduced_at is null
  )::int as "toTargetUnintroduced",
  count(cards.id) filter (
    where cards.direction = 'to_target'
      and cards.introduced_at is not null
      and cards.state <> 'new' and cards.due_at <= ${now}
  )::int as "toTargetDue",
  count(cards.id) filter (
    where cards.direction = 'to_target'
      and cards.introduced_at is not null
      and cards.state = 'new'
  )::int as "toTargetFirstReviews",
  min(cards.due_at) filter (
    where cards.direction = 'to_target'
      and cards.introduced_at is not null
      and cards.due_at > ${now}
  ) as "toTargetNextDueAt",
  'to_native' = any(co.directions) as "toNativeEnabled",
  count(cards.id) filter (
    where cards.direction = 'to_native'
  )::int as "toNativeTotal",
  count(cards.id) filter (
    where cards.direction = 'to_native'
      and cards.introduced_at is not null
  )::int as "toNativeIntroduced",
  count(cards.id) filter (
    where cards.direction = 'to_native'
      and cards.introduced_at is null
  )::int as "toNativeUnintroduced",
  count(cards.id) filter (
    where cards.direction = 'to_native'
      and cards.introduced_at is not null
      and cards.state <> 'new' and cards.due_at <= ${now}
  )::int as "toNativeDue",
  count(cards.id) filter (
    where cards.direction = 'to_native'
      and cards.introduced_at is not null
      and cards.state = 'new'
  )::int as "toNativeFirstReviews",
  min(cards.due_at) filter (
    where cards.direction = 'to_native'
      and cards.introduced_at is not null
      and cards.due_at > ${now}
  ) as "toNativeNextDueAt"
`;

const directionProgress = (
  direction: AnswerDirection,
  columns: Omit<DirectionProgress, 'direction'>,
): DirectionProgress => ({ direction, ...columns });

export const wordProgressFromRow = <Place extends object>(
  row: WordProgressRow<Place>,
): Place & WordProgress => {
  const {
    toTargetEnabled,
    toTargetTotal,
    toTargetIntroduced,
    toTargetUnintroduced,
    toTargetDue,
    toTargetFirstReviews,
    toTargetNextDueAt,
    toNativeEnabled,
    toNativeTotal,
    toNativeIntroduced,
    toNativeUnintroduced,
    toNativeDue,
    toNativeFirstReviews,
    toNativeNextDueAt,
    ...place
  } = row;
  const directions: Array<DirectionProgress> = [];
  if (toTargetEnabled) {
    directions.push(
      directionProgress('to_target', {
        total: toTargetTotal,
        introduced: toTargetIntroduced,
        unintroduced: toTargetUnintroduced,
        due: toTargetDue,
        firstReviews: toTargetFirstReviews,
        nextDueAt: toTargetNextDueAt,
      }),
    );
  }
  if (toNativeEnabled) {
    directions.push(
      directionProgress('to_native', {
        total: toNativeTotal,
        introduced: toNativeIntroduced,
        unintroduced: toNativeUnintroduced,
        due: toNativeDue,
        firstReviews: toNativeFirstReviews,
        nextDueAt: toNativeNextDueAt,
      }),
    );
  }
  // The rest spread keeps every place and summary column; TypeScript only
  // models it as an Omit of the generic row, which it cannot simplify.
  return { ...place, directions } as unknown as Place & WordProgress;
};
