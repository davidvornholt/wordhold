import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { importTermPage } from '../import-fn';
import {
  advanceBatchReview,
  type BatchReviewSearchData,
} from '../schemas/batch-review-search';
import { retryNotesExtraction } from '../server-fns';
import type { NotesReading } from '../services/repository';
import { useActionRunner } from './use-action-runner';
import { useVerificationNavigation } from './use-verification-navigation';

type TermVerificationPage = {
  readonly extraction: NotesReading | null;
  readonly id: string;
};

type SavedTerms = {
  readonly courseId: string;
  readonly entryIds: ReadonlyArray<string>;
};

// Saving a page moves on to the batch's next page. After the last one the
// subject opens, so the learner sees the terms where they now live.
export const useTermVerificationFlow = (
  page: TermVerificationPage,
  search: BatchReviewSearchData,
  onSaved: (saved: SavedTerms) => void,
) => {
  const [reading, setReading] = useState(page.extraction);
  const actions = useActionRunner();
  const navigation = useVerificationNavigation(page.id, search);
  const navigate = useNavigate();

  const retryReading = () =>
    actions.run(async () => {
      setReading(await retryNotesExtraction({ data: page.id }));
    });
  const submitTerms = (
    terms: ReadonlyArray<{
      readonly term: string;
      readonly definition: string;
    }>,
  ) =>
    actions.run(async () => {
      const saved = await importTermPage({
        data: { pageId: page.id, terms },
      });
      onSaved(saved);
      await navigation.refreshOverview();
      const next =
        navigation.batchSession === null
          ? null
          : advanceBatchReview(navigation.batchSession);
      if (next === null) {
        navigation.retireCachedOverview();
        await navigate({
          params: { courseId: saved.courseId },
          to: '/courses/$courseId',
        });
        return;
      }
      await navigate({
        params: { pageId: next.pageId },
        search: next.search,
        to: '/pages/$pageId/verify',
      });
    });

  return {
    ...actions,
    batchIsLastPage: navigation.batchIsLastPage,
    batchSession: navigation.batchSession,
    reading,
    retryReading,
    submitTerms,
  };
};
