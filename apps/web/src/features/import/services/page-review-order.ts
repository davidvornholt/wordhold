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
  readonly reviewOrder?: PageReviewOrder | null;
  readonly reviewPosition?: number | null;
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
  readonly pages: ReadonlyArray<
    Page & {
      readonly pageNumber: number | null;
      readonly reviewPosition: number | null;
    }
  >;
} => {
  const detectedPages = pages.map((page) => ({
    ...page,
    detectedPageNumber: detectedPageNumberFrom(page.extraction),
  }));
  const storedReviewOrder = pages.find(
    (page) => page.reviewOrder !== undefined && page.reviewOrder !== null,
  )?.reviewOrder;
  const reliableNumbers = detectedPages.flatMap((page) =>
    page.detectedPageNumber !== null &&
    page.detectedPageNumber.confidence >= minimumPageNumberConfidence
      ? [page.detectedPageNumber.value]
      : [],
  );
  const sortByPageNumber =
    reliableNumbers.length === pages.length &&
    new Set(reliableNumbers).size === pages.length;
  const inferredOrder: PageReviewOrder = sortByPageNumber
    ? 'page_number'
    : 'scan';
  const order =
    storedReviewOrder ??
    (pages.some((page) => page.status === 'verified') ? 'scan' : inferredOrder);
  const hasReviewPositions = pages.every(
    (page) => page.reviewPosition !== undefined && page.reviewPosition !== null,
  );
  const comparePages = (
    left: (typeof detectedPages)[number],
    right: (typeof detectedPages)[number],
  ): number => {
    const {
      detectedPageNumber: leftPageNumber,
      position: leftPosition,
      reviewPosition: leftReviewPosition,
    } = left;
    const {
      detectedPageNumber: rightPageNumber,
      position: rightPosition,
      reviewPosition: rightReviewPosition,
    } = right;
    if (hasReviewPositions) {
      return (leftReviewPosition ?? 0) - (rightReviewPosition ?? 0);
    }
    if (order === 'page_number') {
      return (leftPageNumber?.value ?? 0) - (rightPageNumber?.value ?? 0);
    }
    return leftPosition - rightPosition;
  };
  const sortedPages = detectedPages.sort(comparePages);
  return {
    order,
    pages: [
      ...sortedPages.filter((page) => page.status === 'verified'),
      ...sortedPages.filter((page) => page.status === 'awaiting_verification'),
    ].map((page) => ({
      ...page,
      pageNumber: page.detectedPageNumber?.value ?? null,
      reviewPosition: page.reviewPosition ?? sortedPages.indexOf(page),
    })),
  };
};
