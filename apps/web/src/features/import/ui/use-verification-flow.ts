import type { ExtractionResult } from '@wordhold/ai/extraction';
import { useEffect, useRef, useState } from 'react';
import { importPage } from '../import-fn';
import type { BatchReviewSearchData } from '../schemas/batch-review-search';
import type { UnitSelectionData } from '../schemas/import-payload';
import { retryAudio, retryExtraction } from '../server-fns';
import { finishAudioRecovery } from './audio-recovery-navigation';
import { useVerificationNavigation } from './use-verification-navigation';
import type { VerificationEntry } from './verify-form-selection';

type VerificationPage = {
  readonly extraction: ExtractionResult | null;
  readonly id: string;
  readonly status: 'awaiting_verification' | 'verified';
};

const toPayloadEntry = (
  draft: VerificationEntry & { readonly unit: UnitSelectionData },
) => ({
  unit: draft.unit,
  targetText: draft.targetText,
  nativeText: draft.nativeText,
  ...(draft.grammar === undefined ? {} : { grammar: draft.grammar }),
  ...(draft.example.trim() === ''
    ? {}
    : {
        example: {
          targetText: draft.example.trim(),
          ...(draft.generatedExample?.nativeText.trim() === '' ||
          draft.generatedExample === undefined
            ? {}
            : { nativeText: draft.generatedExample.nativeText.trim() }),
          source:
            draft.generatedExample === undefined
              ? ('textbook' as const)
              : ('generated' as const),
        },
      }),
  ...(draft.duplicateException === true ? { duplicateException: true } : {}),
  ...(draft.skipDuplicate === true ? { skipDuplicate: true } : {}),
});

const useActionRunner = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
};

export const useVerificationFlow = (
  page: VerificationPage,
  search: BatchReviewSearchData,
) => {
  const [extraction, setExtraction] = useState(page.extraction);
  const [completed, setCompleted] = useState<{
    readonly imported: number | null;
  } | null>(page.status === 'verified' ? { imported: null } : null);
  const actions = useActionRunner();
  const navigation = useVerificationNavigation(page.id, search);
  const active = useRef<boolean>(true);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  const retryPageExtraction = () =>
    actions.run(async () => {
      const updated = await retryExtraction({ data: page.id });
      setExtraction(updated.extraction);
    });
  const retryPageAudio = () =>
    actions.run(() =>
      finishAudioRecovery({
        retry: () => retryAudio({ data: page.id }).then(() => undefined),
        refreshOverview: navigation.refreshOverview,
        finishNavigation: () =>
          navigation.batchSession === null
            ? navigation.goToOverview()
            : navigation.advanceReview(),
        shouldNavigate: () => active.current,
      }),
    );
  const submitPage = (verified: ReadonlyArray<VerificationEntry>) =>
    actions.run(async () => {
      const result = await importPage({
        data: {
          pageId: page.id,
          entries: verified.map(toPayloadEntry),
        },
      });
      await navigation.refreshOverview();
      if (navigation.batchSession !== null) {
        await navigation.advanceReview();
        return;
      }
      if (result.audio.pending === 0) {
        await navigation.goToOverview();
        return;
      }
      setCompleted({
        imported: result.imported,
      });
    });

  return {
    ...actions,
    ...navigation,
    completed,
    extraction,
    leavePage: () => {
      active.current = false;
    },
    retryPageAudio,
    retryPageExtraction,
    submitPage,
  };
};
