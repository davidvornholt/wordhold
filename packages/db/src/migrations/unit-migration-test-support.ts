import { Effect } from 'effect';
import { makeDrizzle } from '../drizzle';

const preUnitMigrations = [
  '0000_overconfident_slyde',
  '0001_moaning_proemial_gods',
  '0002_many_prodigy',
  '0003_chief_mojo',
] as const;

const unitMigrations = [
  '0004_watery_iron_patriot',
  '0005_known_captain_universe',
] as const;

const requiredUnitMigrations = ['0006_smooth_sue_storm'] as const;
const learningMigrations = ['0007_soft_machine_man'] as const;

const applyGeneratedMigrations = (
  url: string,
  migrations: ReadonlyArray<string>,
) =>
  Effect.acquireUseRelease(
    Effect.sync(() => makeDrizzle(url)),
    (database) =>
      Effect.tryPromise({
        try: async () => {
          for (const migration of migrations) {
            // biome-ignore lint/performance/noAwaitInLoops: generated migrations must run in journal order
            await database.$client.file(
              new URL(`../../drizzle/${migration}.sql`, import.meta.url),
            );
          }
        },
        catch: (cause) =>
          new Error('Could not apply generated test migrations.', { cause }),
      }),
    (database) => Effect.promise(() => database.$client.end()),
  );

export const migrateToPreUnitSchema = (url: string) =>
  applyGeneratedMigrations(url, preUnitMigrations);

export const migrateToNullableUnits = (url: string) =>
  applyGeneratedMigrations(url, unitMigrations);

export const migrateToRequiredUnits = (url: string) =>
  applyGeneratedMigrations(url, requiredUnitMigrations);

export const migrateToLearningSchema = (url: string) =>
  applyGeneratedMigrations(url, learningMigrations);
