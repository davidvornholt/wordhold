import type { Sql } from 'postgres';
import { MigrationError } from './migration-error';

type PageRow = {
  readonly id: string;
  readonly courseId: string;
  readonly label: string | null;
  readonly ordinal: string;
};

type IdRow = { readonly id: string };

const unitName = (page: PageRow): string => {
  const label = page.label?.trim();
  return `Einheit ${page.ordinal}${label ? ` – ${label}` : ''}`;
};

export const backfillUnits = async (sql: Sql): Promise<void> => {
  await sql.begin(async (transaction) => {
    const mismatches = await transaction<Array<IdRow>>`
      select entries.id
      from entries
      join units on units.id = entries.unit_id
      where entries.course_id <> units.course_id
      limit 1
    `;
    if (mismatches.length > 0) {
      throw new MigrationError({
        cause: mismatches[0],
        message:
          'Unit backfill stopped because an entry references a unit from another course.',
      });
    }

    const pages = await transaction<Array<PageRow>>`
      select pages.id,
        pages.course_id as "courseId",
        nullif(btrim(pages.label), '') as label,
        row_number() over (
          partition by pages.course_id
          order by pages.captured_at, pages.id
        )::text as ordinal
      from pages
      where exists (
        select 1
        from entries
        where entries.page_id = pages.id
          and entries.unit_id is null
      )
      order by pages.course_id, pages.captured_at, pages.id
    `;

    await Promise.all(
      pages.map(async (page) => {
        const position = Number(page.ordinal) - 1;
        const [unit] = await transaction<Array<IdRow>>`
        insert into units (course_id, name, position, is_holding)
        values (${page.courseId}, ${unitName(page)}, ${position}, false)
        on conflict (course_id, name) do update set name = excluded.name
        returning id
      `;
        if (unit === undefined) {
          throw new MigrationError({
            cause: page,
            message: 'Unit backfill did not return the page unit it created.',
          });
        }
        await transaction`
        update entries
        set unit_id = ${unit.id}
        where course_id = ${page.courseId}
          and page_id = ${page.id}
          and unit_id is null
      `;
      }),
    );

    const orphanedCourses = await transaction<Array<IdRow>>`
      select distinct course_id as id
      from entries
      where unit_id is null
    `;
    await Promise.all(
      orphanedCourses.map(async (course) => {
        const [unit] = await transaction<Array<IdRow>>`
        insert into units (course_id, name, position, is_holding)
        select ${course.id},
          'Ohne Einheit',
          coalesce(max(position) + 1, 0),
          true
        from units
        where course_id = ${course.id}
        on conflict (course_id, name) do update set is_holding = true
        returning id
      `;
        if (unit === undefined) {
          throw new MigrationError({
            cause: course,
            message:
              'Unit backfill did not return the holding unit it created.',
          });
        }
        await transaction`
        update entries
        set unit_id = ${unit.id}
        where course_id = ${course.id}
          and unit_id is null
      `;
      }),
    );

    const unfiled = await transaction<Array<{ readonly count: string }>>`
      select count(*)::text as count from entries where unit_id is null
    `;
    if (unfiled[0]?.count !== '0') {
      throw new MigrationError({
        cause: unfiled[0],
        message: 'Unit backfill left vocabulary without a unit.',
      });
    }
  });
};
