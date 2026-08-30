import { Option, Schema } from 'effect';
import { maximumUploadBatchSize } from '../services/upload-queue';

const BatchReviewSearch = Schema.Struct({
  batch: Schema.optional(Schema.String),
  step: Schema.optional(Schema.Number),
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
};

export type BatchReviewSummary = {
  readonly total: number;
};

type BatchReviewDestination = {
  readonly pageId: string;
  readonly search: Required<BatchReviewSearchData>;
};

export const batchReviewSearchFor = (
  pageIds: ReadonlyArray<string>,
  firstPageId?: string,
): Required<BatchReviewSearchData> => {
  const validPageIds = uniquePageIds(pageIds);
  const firstPosition =
    firstPageId === undefined ? 0 : validPageIds.indexOf(firstPageId);
  return {
    batch: validPageIds.join(','),
    step: Math.max(firstPosition, 0),
  };
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
  if (
    !Number.isInteger(position) ||
    position < 0 ||
    position >= pageIds.length ||
    pageIds[position] !== currentPageId
  ) {
    return null;
  }
  return { pageIds, position };
};

export const advanceBatchReview = (
  session: BatchReviewSession,
): BatchReviewDestination | BatchReviewSummary => {
  const nextPosition = session.position + 1;
  const nextPageId = session.pageIds[nextPosition];
  if (nextPageId === undefined) {
    return { total: session.pageIds.length };
  }
  return {
    pageId: nextPageId,
    search: {
      batch: session.pageIds.join(','),
      step: nextPosition,
    },
  };
};
