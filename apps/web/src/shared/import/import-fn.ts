import { createServerFn } from '@tanstack/react-start';
import { Tts } from '@wordhold/ai/tts';
import { courses, type LanguageCode } from '@wordhold/db/schema/courses';
import {
  acceptedAnswers,
  entries,
  entryAudio,
  entryExamples,
} from '@wordhold/db/schema/entries';
import { pages } from '@wordhold/db/schema/pages';
import { cards } from '@wordhold/db/schema/practice';
import { and, eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { ttsRuntime } from '../ai/runtime';
import { requireSession } from '../auth/require-session';
import { db } from '../db/server';
import { normalizeAnswer } from '../grading/normalize';
import { reconcileStoredFiles } from '../storage/reconcile-server';
import { removeDataFile, writeDataFile } from '../storage/server';
import { generateAudio } from './audio-generation';
import { decodeImportPayload, type ImportPayloadData } from './schema';
import { commitVerifiedPage } from './verification-commit';

type InsertedEntry = { readonly id: string; readonly targetText: string };

const insertVerifiedEntries = (
  payload: ImportPayloadData,
  courseId: string,
): Promise<Array<InsertedEntry>> =>
  commitVerifiedPage(async (work) =>
    db.transaction(async (tx) =>
      work({
        claimPage: async () => {
          const [claimed] = await tx
            .update(pages)
            .set({
              status: 'verified',
              label: payload.label ?? null,
              verifiedAt: new Date(),
            })
            .where(
              and(
                eq(pages.id, payload.pageId),
                eq(pages.status, 'awaiting_verification'),
              ),
            )
            .returning({ id: pages.id });
          return claimed !== undefined;
        },
        insertEntries: async () => {
          const inserted = await tx
            .insert(entries)
            .values(
              payload.entries.map((entry) => ({
                courseId,
                pageId: payload.pageId,
                type: entry.type,
                targetText: entry.targetText,
                nativeText: entry.nativeText,
                grammar: entry.grammar ?? null,
              })),
            )
            .returning({ id: entries.id, targetText: entries.targetText });

          const exampleRows: Array<typeof entryExamples.$inferInsert> = [];
          const answerRows: Array<typeof acceptedAnswers.$inferInsert> = [];
          const cardRows: Array<typeof cards.$inferInsert> = [];
          payload.entries.forEach((entry, index) => {
            const entryId = inserted[index]?.id;
            if (entryId === undefined) {
              return;
            }
            if (entry.example !== undefined && entry.example !== '') {
              exampleRows.push({
                entryId,
                targetText: entry.example,
                source: 'textbook',
              });
            }
            answerRows.push(
              {
                entryId,
                direction: 'to_target',
                text: entry.targetText,
                normalized: normalizeAnswer(entry.targetText),
                source: 'textbook',
              },
              {
                entryId,
                direction: 'to_native',
                text: entry.nativeText,
                normalized: normalizeAnswer(entry.nativeText),
                source: 'textbook',
              },
            );
            cardRows.push(
              { entryId, direction: 'to_target' },
              { entryId, direction: 'to_native' },
            );
          });
          if (exampleRows.length > 0) {
            await tx.insert(entryExamples).values(exampleRows);
          }
          await tx
            .insert(acceptedAnswers)
            .values(answerRows)
            .onConflictDoNothing();
          await tx.insert(cards).values(cardRows);
          return inserted;
        },
      }),
    ),
  );

export const importPage = createServerFn({ method: 'POST' })
  .validator((input: unknown) => decodeImportPayload(input))
  .handler(async ({ data }) => {
    await requireSession();
    const [row] = await db
      .select()
      .from(pages)
      .innerJoin(courses, eq(pages.courseId, courses.id))
      .where(eq(pages.id, data.pageId));
    if (row === undefined) {
      throw new Error('Seite nicht gefunden.');
    }
    if (row.pages.status !== 'awaiting_verification') {
      throw new Error('Diese Seite wurde bereits importiert.');
    }
    await reconcileStoredFiles();
    const inserted = await insertVerifiedEntries(data, row.pages.courseId);
    const audioGenerated = await generateAudio(
      inserted,
      row.courses.targetLanguage,
      {
        synthesize: (text, language: LanguageCode) =>
          ttsRuntime.runPromise(
            Effect.gen(function* () {
              const tts = yield* Tts;
              return yield* tts.synthesize({ text, language });
            }),
          ),
        writeFile: writeDataFile,
        removeFile: removeDataFile,
        insertReference: async (entryId, voice, path) => {
          await db
            .insert(entryAudio)
            .values({ entryId, voice, path })
            .onConflictDoUpdate({
              target: [entryAudio.entryId, entryAudio.voice],
              set: { path },
            });
        },
      },
    );
    return { imported: inserted.length, audioGenerated };
  });
