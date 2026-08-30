import { Option, Schema } from 'effect';
import { maximumUploadBatchSize } from '../services/upload-queue';

const BatchReviewSearch = Schema.Struct({
  batch: Schema.optional(Schema.String),
  step: Schema.optional(Schema.Number),
  skipped: Schema.optional(Schema.Number),
});

export type BatchReviewSearchData = typeof BatchReviewSearch.Type;

const decodeSearch = Schema.decodeUnknownOption(BatchReviewSearch);

export const parseBatchReviewSearch = (input: unknown): BatchReviewSearchData =>
  Option.getOrElse(decodeSearch(input), (): BatchReviewSearchData => ({}));

const pageIdIsValid = Schema.is(Schema.UUID);

const uniquePageIds = (
  pageIds: ReadonlyArray<string>,
): ReadonlyArray<string> => [
  ...new Set(pageIds.filter(pageIdIsValid).slice(0, maximumUploadBatchSize)),
];

export type BatchReviewSession = {
  readonly pageIds: ReadonlyArray<string>;
  readonly position: number;
  readonly skipped: number;
};

export type BatchReviewSummary = {
  readonly imported: number;
  readonly skipped: number;
  readonly total: number;
};

type BatchReviewDestination = {
  readonly pageId: string;
  readonly search: Required<BatchReviewSearchData>;
};

export const batchReviewSearchFor = (
  pageIds: ReadonlyArray<string>,
  firstPageId: string,
): Required<BatchReviewSearchData> => {
  const validPageIds = uniquePageIds(pageIds);
  const firstIndex = validPageIds.indexOf(firstPageId);
  const orderedPageIds =
    firstIndex < 1
      ? validPageIds
      : [
          ...validPageIds.slice(firstIndex),
          ...validPageIds.slice(0, firstIndex),
        ];
  return { batch: orderedPageIds.join(','), step: 0, skipped: 0 };
};

export const resolveBatchReviewSession = (
  search: BatchReviewSearchData,
  currentPageId: string,
): BatchReviewSession | null => {
  if (search.batch === undefined) {
    return null;
  }
  const pageIds = uniquePageIds(search.batch.split(','));
  const position = search.step ?? 0;
  const skipped = search.skipped ?? 0;
  if (
    !Number.isInteger(position) ||
    position < 0 ||
    position >= pageIds.length ||
    pageIds[position] !== currentPageId ||
    !Number.isInteger(skipped) ||
    skipped < 0 ||
    skipped > position
  ) {
    return null;
  }
  return { pageIds, position, skipped };
};

export const advanceBatchReview = (
  session: BatchReviewSession,
  skipCurrent: boolean,
): BatchReviewDestination | BatchReviewSummary => {
  const skipped = session.skipped + (skipCurrent ? 1 : 0);
  const nextPosition = session.position + 1;
  const nextPageId = session.pageIds[nextPosition];
  if (nextPageId === undefined) {
    return {
      imported: session.pageIds.length - skipped,
      skipped,
      total: session.pageIds.length,
    };
  }
  return {
    pageId: nextPageId,
    search: {
      batch: session.pageIds.join(','),
      step: nextPosition,
      skipped,
    },
  };
};
