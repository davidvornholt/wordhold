type FreshOverviewNavigation = {
  readonly clearOverviewCache: () => void;
  readonly navigate: () => Promise<void>;
};

type OverviewMatch = {
  readonly routeId: string;
};

type OverviewInvalidator = (options: {
  readonly filter: (match: OverviewMatch) => boolean;
  readonly sync: true;
}) => Promise<void>;

type OverviewCache = Pick<FreshOverviewNavigation, 'clearOverviewCache'>;

export const retireOverviewCache = ({
  clearOverviewCache,
}: OverviewCache): void => {
  clearOverviewCache();
};

export const refreshOverviewAfterMutation = (
  invalidate: OverviewInvalidator,
): Promise<void> =>
  invalidate({
    filter: (match) =>
      match.routeId === '/' || match.routeId === '/imports/$sessionId',
    sync: true,
  });

export const returnToFreshOverview = async ({
  clearOverviewCache,
  navigate,
}: FreshOverviewNavigation): Promise<void> => {
  retireOverviewCache({ clearOverviewCache });
  await navigate();
};
