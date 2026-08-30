import { describe, expect, it } from 'bun:test';
import {
  detectedPageNumberFrom,
  importSessionIsComplete,
  orderPagesForReview,
} from './page-review-order';

const earlierPageNumber = 46;
const middlePageNumber = 47;
const laterPageNumber = 48;
const reliableConfidence = 0.99;
const observedConfidence = 0.98;
const unreliableConfidence = 0.89;

type PageOptions = {
  readonly id: string;
  readonly pageNumber: number | null;
  readonly pageNumberConfidence?: number | null;
  readonly position: number;
  readonly status?: 'awaiting_verification' | 'verified';
};

const page = ({
  id,
  pageNumber,
  pageNumberConfidence = reliableConfidence,
  position,
  status = 'awaiting_verification',
}: PageOptions) => ({
  id,
  extraction:
    pageNumber === null || pageNumberConfidence === null
      ? null
      : {
          page: { pageNumber, pageNumberConfidence },
        },
  position,
  status,
});

describe('page review order', () => {
  it('requires every expected scan position before review', () => {
    expect(
      importSessionIsComplete([
        { expectedPageCount: 2, position: 0 },
        { expectedPageCount: 2, position: 1 },
      ]),
    ).toBe(true);
    expect(
      importSessionIsComplete([{ expectedPageCount: 2, position: 1 }]),
    ).toBe(false);
  });

  it('reads a validated page number from stored extraction data', () => {
    expect(
      detectedPageNumberFrom({
        modelId: 'test-model',
        page: {
          entries: [],
          overallConfidence: 1,
          pageNumber: middlePageNumber,
          pageNumberConfidence: observedConfidence,
        },
      }),
    ).toEqual({
      confidence: observedConfidence,
      value: middlePageNumber,
    });
    expect(detectedPageNumberFrom({ page: { pageNumber: '47' } })).toBeNull();
  });

  it('orders a complete, reliable set by printed page number', () => {
    const result = orderPagesForReview([
      page({ id: 'scan-1', pageNumber: laterPageNumber, position: 0 }),
      page({ id: 'scan-2', pageNumber: earlierPageNumber, position: 1 }),
      page({ id: 'scan-3', pageNumber: middlePageNumber, position: 2 }),
    ]);

    expect(result.order).toBe('page_number');
    expect(result.pages.map(({ id }) => id)).toEqual([
      'scan-2',
      'scan-3',
      'scan-1',
    ]);
  });

  it('keeps scan order when any page number is missing or unreliable', () => {
    for (const uncertainPage of [
      page({
        id: 'scan-2',
        pageNumber: null,
        pageNumberConfidence: null,
        position: 1,
      }),
      page({
        id: 'scan-2',
        pageNumber: earlierPageNumber,
        pageNumberConfidence: unreliableConfidence,
        position: 1,
      }),
    ]) {
      const result = orderPagesForReview([
        page({ id: 'scan-1', pageNumber: laterPageNumber, position: 0 }),
        uncertainPage,
        page({ id: 'scan-3', pageNumber: middlePageNumber, position: 2 }),
      ]);

      expect(result.order).toBe('scan');
      expect(result.pages.map(({ id }) => id)).toEqual([
        'scan-1',
        'scan-2',
        'scan-3',
      ]);
    }
  });

  it('keeps scan order when two photos report the same page number', () => {
    const result = orderPagesForReview([
      page({ id: 'scan-1', pageNumber: laterPageNumber, position: 0 }),
      page({ id: 'scan-2', pageNumber: laterPageNumber, position: 1 }),
    ]);

    expect(result.order).toBe('scan');
    expect(result.pages.map(({ id }) => id)).toEqual(['scan-1', 'scan-2']);
  });

  it('keeps completed pages ahead of the remaining numbered sequence', () => {
    const result = orderPagesForReview([
      page({
        id: 'scan-1',
        pageNumber: laterPageNumber,
        position: 0,
        status: 'verified',
      }),
      page({ id: 'scan-2', pageNumber: earlierPageNumber, position: 1 }),
      page({ id: 'scan-3', pageNumber: middlePageNumber, position: 2 }),
    ]);

    expect(result.pages.map(({ id }) => id)).toEqual([
      'scan-1',
      'scan-2',
      'scan-3',
    ]);
  });
});
