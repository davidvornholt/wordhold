import { createContext, useContext } from 'react';

// The IANA zone, such as "Europe/Berlin", that every date on a page is
// written in. The root route provides the zone it loaded from the server, so
// a date reads the same in the server's HTML and in the browser.
export const OwnerTimeZoneContext = createContext<string | null>(null);

// Without a provider there is no zone that both sides agree on, so this
// fails instead of falling back to the zone of whatever process renders.
export const useOwnerTimeZone = (): string => {
  const timeZone = useContext(OwnerTimeZoneContext);
  if (timeZone === null) {
    throw new Error('Dates need an OwnerTimeZoneContext above them.');
  }
  return timeZone;
};
