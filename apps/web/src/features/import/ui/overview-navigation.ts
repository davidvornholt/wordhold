type FreshOverviewNavigation = {
  readonly clearOverviewCache: () => void;
  readonly navigate: () => Promise<void>;
};

export const returnToFreshOverview = async ({
  clearOverviewCache,
  navigate,
}: FreshOverviewNavigation): Promise<void> => {
  clearOverviewCache();
  await navigate();
};
