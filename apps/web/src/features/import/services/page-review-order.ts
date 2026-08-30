import { maximumPageNumber } from '@wordhold/ai/extraction/schema';
import { Option, Schema } from 'effect';

export const minimumPageNumberConfidence = 0.9;

const StoredPageNumber = Schema.Struct({
  page: Schema.Struct({
    pageNumber: Schema.Number.pipe(
      Schema.int(),
      Schema.between(1, maximumPageNumber),
    ),
    pageNumberConfidence: Schema.Number.pipe(Schema.between(0, 1)),
  }),
});

const decodeStoredPageNumber = Schema.decodeUnknownOption(StoredPageNumber);

export type DetectedPageNumber = {
  readonly confidence: number;
  readonly value: number;
};

export const detectedPageNumberFrom = (
  extraction: unknown,
): DetectedPageNumber | null => {
  const decoded = Option.getOrUndefined(decodeStoredPageNumber(extraction));
  return decoded === undefined
    ? null
    : {
        confidence: decoded.page.pageNumberConfidence,
        value: decoded.page.pageNumber,
      };
};

type StoredReviewPage = {
  readonly extraction: unknown;
  readonly position: number;
  readonly status: 'awaiting_verification' | 'verified';
};

type SessionPage = {
  readonly expectedPageCount: number;
  readonly position: number;
};

export type PageReviewOrder = 'page_number' | 'scan';

export const importSessionIsComplete = (
  pages: ReadonlyArray<SessionPage>,
): boolean => {
  const [firstPage] = pages;
  return (
    firstPage !== undefined &&
    pages.length === firstPage.expectedPageCount &&
    pages.every((page, index) => page.position === index)
  );
};

export const orderPagesForReview = <Page extends StoredReviewPage>(
  pages: ReadonlyArray<Page>,
): {
  readonly order: PageReviewOrder;
  readonly pages: ReadonlyArray<Page & { readonly pageNumber: number | null }>;
} => {
  const detectedPages = pages.map((page) => ({
    ...page,
    detectedPageNumber: detectedPageNumberFrom(page.extraction),
  }));
  const reliableNumbers = detectedPages.flatMap((page) =>
    page.detectedPageNumber !== null &&
    page.detectedPageNumber.confidence >= minimumPageNumberConfidence
      ? [page.detectedPageNumber.value]
      : [],
  );
  const sortByPageNumber =
    reliableNumbers.length === pages.length &&
    new Set(reliableNumbers).size === pages.length;
  const sortedPages = detectedPages.sort((left, right) =>
    sortByPageNumber
      ? (left.detectedPageNumber?.value ?? 0) -
        (right.detectedPageNumber?.value ?? 0)
      : left.position - right.position,
  );
  return {
    order: sortByPageNumber ? 'page_number' : 'scan',
    pages: [
      ...sortedPages.filter((page) => page.status === 'verified'),
      ...sortedPages.filter((page) => page.status === 'awaiting_verification'),
    ].map((page) => ({
      ...page,
      pageNumber: page.detectedPageNumber?.value ?? null,
    })),
  };
};
