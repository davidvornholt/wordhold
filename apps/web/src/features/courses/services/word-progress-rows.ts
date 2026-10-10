import type { Database } from '@wordhold/db/client';
import {
  type AnswerDirection,
  answerDirections,
} from '@wordhold/db/schema/directions';
import { isRelationDirection } from '../../../shared/directions';
import { practisedDirections } from '../../../shared/practice/practised-directions';
import type { DirectionProgress, WordProgress } from '../schemas/course-units';

type ColumnPrefix = 'toTarget' | 'toNative' | 'toSynonym' | 'toAntonym';

// Each direction's columns carry its name as a prefix, such as
// `toSynonymTotal`.
const columnPrefix = (direction: AnswerDirection): ColumnPrefix => {
  switch (direction) {
    case 'to_target':
      return 'toTarget';
    case 'to_native':
      return 'toNative';
    case 'to_synonym':
      return 'toSynonym';
    case 'to_antonym':
      return 'toAntonym';
    default:
      return direction satisfies never;
  }
};
type DirectionCounts = Omit<DirectionProgress, 'direction'>;

type DirectionColumns = {
  readonly [Prefix in ColumnPrefix as `${Prefix}Enabled`]: boolean;
} & {
  readonly [Count in keyof DirectionCounts as `${ColumnPrefix}${Capitalize<Count>}`]: DirectionCounts[Count];
};

export type WordProgressRow<Place> = Place &
  Omit<WordProgress, 'directions'> &
  DirectionColumns;

const directionColumns = (
  sql: Database,
  direction: AnswerDirection,
  now: Date,
) => {
  // A literal rather than an identifier: the client would turn an identifier
  // into snake case, and the row would no longer carry this name.
  const column = (name: string) =>
    sql.literal(`"${columnPrefix(direction)}${name}"`);
  const asked = sql`cards.direction = ${direction}::answer_direction`;
  return sql`
    ${direction}::answer_direction = any(${practisedDirections(sql)})
      as ${column('Enabled')},
    count(cards.id) filter (where ${asked})::int as ${column('Total')},
    count(cards.id) filter (
      where ${asked} and cards.introduced_at is not null
    )::int as ${column('Introduced')},
    count(cards.id) filter (
      where ${asked} and cards.introduced_at is null
    )::int as ${column('Unintroduced')},
    count(cards.id) filter (
      where ${asked} and cards.introduced_at is not null
        and cards.state <> 'new' and cards.due_at <= ${now}
    )::int as ${column('Due')},
    count(cards.id) filter (
      where ${asked} and cards.introduced_at is not null
        and cards.state = 'new'
    )::int as ${column('FirstReviews')},
    min(cards.due_at) filter (
      where ${asked} and cards.introduced_at is not null
        and cards.due_at > ${now}
    ) as ${column('NextDueAt')}
  `;
};

// The progress columns of a query that groups entries `e` with their `cards`
// by book or unit, joined to the course `co`. An entry remains unintroduced
// while one of the course's practised directions has not been introduced. A
// switched-off direction stays out of the learner's way until it is switched
// on again.
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
        and pending.direction = any(${practisedDirections(sql)})
        and pending.introduced_at is null
    )
  )::int as unintroduced,
  count(cards.id) filter (
    where cards.introduced_at is not null
      and cards.direction = any(${practisedDirections(sql)})
      and cards.state <> 'new' and cards.due_at <= ${now}
  )::int as due,
  count(cards.id) filter (
    where cards.introduced_at is not null
      and cards.direction = any(${practisedDirections(sql)})
      and cards.state = 'new'
  )::int as "firstReviews",
  min(cards.due_at) filter (
    where cards.introduced_at is not null
      and cards.direction = any(${practisedDirections(sql)})
      and cards.due_at > ${now}
  ) as "nextDueAt",
  max(e.created_at) as "lastAddedAt",
  ${sql.csv(answerDirections.map((direction) => directionColumns(sql, direction, now)))}
`;

const directionColumnNames = new Set<string>(
  answerDirections
    .map(columnPrefix)
    .flatMap((prefix) =>
      [
        'Enabled',
        'Total',
        'Introduced',
        'Unintroduced',
        'Due',
        'FirstReviews',
        'NextDueAt',
      ].map((name) => `${prefix}${name}`),
    ),
);

// A translation direction the course practises is listed even before a
// word has a card in it. A synonym or antonym direction is listed only where
// a word has such a list.
const directionProgress = (
  row: DirectionColumns,
  direction: AnswerDirection,
): ReadonlyArray<DirectionProgress> => {
  const prefix = columnPrefix(direction);
  const progress: DirectionProgress = {
    direction,
    total: row[`${prefix}Total` as const],
    introduced: row[`${prefix}Introduced` as const],
    unintroduced: row[`${prefix}Unintroduced` as const],
    due: row[`${prefix}Due` as const],
    firstReviews: row[`${prefix}FirstReviews` as const],
    nextDueAt: row[`${prefix}NextDueAt` as const],
  };
  const listed =
    row[`${prefix}Enabled` as const] &&
    (progress.total > 0 || !isRelationDirection(direction));
  return listed ? [progress] : [];
};

export const wordProgressFromRow = <Place extends object>(
  row: WordProgressRow<Place>,
): Place & WordProgress => {
  const place = Object.fromEntries(
    Object.entries(row).filter(([name]) => !directionColumnNames.has(name)),
  );
  const directions = answerDirections.flatMap((direction) =>
    directionProgress(row, direction),
  );
  // The filtered entries keep every place and summary column; TypeScript
  // cannot follow that through Object.fromEntries.
  return { ...place, directions } as unknown as Place & WordProgress;
};
