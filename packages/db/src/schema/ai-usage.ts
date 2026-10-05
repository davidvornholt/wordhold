import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { user } from './auth';

export const aiProviders = ['bedrock', 'polly', 'transcribe'] as const;
export type AiProvider = (typeof aiProviders)[number];
export const aiProviderEnum = pgEnum('ai_provider', aiProviders);

export const aiUsageStatuses = ['pending', 'succeeded', 'failed'] as const;
export type AiUsageStatus = (typeof aiUsageStatuses)[number];
export const aiUsageStatusEnum = pgEnum('ai_usage_status', aiUsageStatuses);

// One row per paid AI request, written as pending before the request starts
// and completed afterwards. The estimate is computed from the reported usage
// and the price snapshot taken at that moment; it stays null when the usage
// or the price is unknown, so an unknown cost never counts as zero. A deleted
// person's rows lose their user but stay in the instance's totals.
export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').references(() => user.id, {
      onDelete: 'set null',
    }),
    operation: text('operation').notNull(),
    provider: aiProviderEnum('provider').notNull(),
    model: text('model').notNull(),
    status: aiUsageStatusEnum('status').notNull().default('pending'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cachedInputTokens: integer('cached_input_tokens'),
    characters: integer('characters'),
    audioSeconds: integer('audio_seconds'),
    usage: jsonb('usage'),
    priceSnapshot: jsonb('price_snapshot'),
    estimatedUsd: numeric('estimated_usd', { precision: 18, scale: 8 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('ai_usage_created_at').on(table.createdAt),
    index('ai_usage_user_id').on(table.userId),
  ],
);
