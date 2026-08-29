type FreshOverviewNavigation = {
  readonly clearOverviewCache: () => void;
  readonly navigate: () => Promise<void>;
};

type OverviewCache = Pick<FreshOverviewNavigation, 'clearOverviewCache'>;

export const retireOverviewCache = ({
  clearOverviewCache,
}: OverviewCache): void => {
  clearOverviewCache();
};

export const returnToFreshOverview = async ({
  clearOverviewCache,
  navigate,
}: FreshOverviewNavigation): Promise<void> => {
  retireOverviewCache({ clearOverviewCache });
  await navigate();
};
