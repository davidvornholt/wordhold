type OwnerSessionIdentity = {
  readonly session: {
    readonly token: string;
  };
  readonly user: {
    readonly id: string;
  };
};

type OwnerSessionDependencies = {
  readonly isAllowedUser: (userId: string) => Promise<boolean>;
  readonly revokeSession: (token: string) => Promise<void>;
};

export const revalidateOwnerSession = async <T extends OwnerSessionIdentity>(
  session: T | null,
  dependencies: OwnerSessionDependencies,
): Promise<T | null> => {
  if (session === null) {
    return null;
  }
  if (await dependencies.isAllowedUser(session.user.id)) {
    return session;
  }
  await dependencies.revokeSession(session.session.token);
  return null;
};
