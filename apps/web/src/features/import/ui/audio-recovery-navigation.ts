type AudioRecoveryAction = {
  readonly finishNavigation: () => Promise<void>;
  readonly refreshOverview: () => Promise<void>;
  readonly retry: () => Promise<void>;
  readonly shouldNavigate: () => boolean;
};

export const finishAudioRecovery = async ({
  finishNavigation,
  refreshOverview,
  retry,
  shouldNavigate,
}: AudioRecoveryAction): Promise<void> => {
  await retry();
  await refreshOverview();
  if (shouldNavigate()) {
    await finishNavigation();
  }
};
