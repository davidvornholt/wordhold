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
import { eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import { ttsRuntime } from '../ai/runtime';
import { requireSession } from '../auth/require-session';
import { db } from '../db/server';
import { normalizeAnswer } from '../grading/normalize';
import { audioRelativePath, writeDataFile } from '../storage/server';
import { ImportPayload, type ImportPayloadData } from './schema';

type InsertedEntry = { readonly id: string; readonly targetText: string };

const insertVerifiedEntries = (
  payload: ImportPayloadData,
  courseId: string,
): Promise<Array<InsertedEntry>> =>
  db.transaction(async (tx) => {
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
      if (entry.example !== undefined && entry.example.trim() !== '') {
        exampleRows.push({
          entryId,
          targetText: entry.example.trim(),
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
    await tx.insert(acceptedAnswers).values(answerRows).onConflictDoNothing();
    await tx.insert(cards).values(cardRows);
    await tx
      .update(pages)
      .set({
        status: 'verified',
        label: payload.label ?? null,
        verifiedAt: new Date(),
      })
      .where(eq(pages.id, payload.pageId));
    return inserted;
  });

// Audio is best-effort at import: a missing Polly credential or transient
// failure must never lose a verified page. After three consecutive failures
// the cause is systemic, so stop instead of timing out per entry.
const maxConsecutiveFailures = 3;

const generateAudio = async (
  insertedEntries: ReadonlyArray<InsertedEntry>,
  language: LanguageCode,
) => {
  let generated = 0;
  let consecutiveFailures = 0;
  for (const entry of insertedEntries) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: deliberately sequential so Polly is not hammered and systemic failures abort early
      const result = await ttsRuntime.runPromise(
        Effect.gen(function* () {
          const tts = yield* Tts;
          return yield* tts.synthesize({ text: entry.targetText, language });
        }),
      );
      const path = audioRelativePath(entry.id, result.voice);
      await writeDataFile(path, result.audio);
      await db
        .insert(entryAudio)
        .values({ entryId: entry.id, voice: result.voice, path })
        .onConflictDoNothing();
      generated += 1;
      consecutiveFailures = 0;
    } catch {
      consecutiveFailures += 1;
      if (consecutiveFailures >= maxConsecutiveFailures) {
        break;
      }
    }
  }
  return generated;
};

export const importPage = createServerFn({ method: 'POST' })
  .validator((input: unknown) => Schema.decodeUnknownSync(ImportPayload)(input))
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
    const inserted = await insertVerifiedEntries(data, row.pages.courseId);
    const audioGenerated = await generateAudio(
      inserted,
      row.courses.targetLanguage,
    );
    return { imported: inserted.length, audioGenerated };
  });
