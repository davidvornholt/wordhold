import { useState } from 'react';
import { retryUnreachable } from './server-retry';

// Runs a server call through `retryUnreachable` and keeps track of whether
// the learner should see that the connection is being restored.
export const useServerRetry = () => {
  const [reconnecting, setReconnecting] = useState(false);
  const retry = async <A>(call: () => Promise<A>): Promise<A> => {
    try {
      return await retryUnreachable(call, {
        onReconnecting: () => setReconnecting(true),
      });
    } finally {
      setReconnecting(false);
    }
  };
  return { reconnecting, retry };
};
