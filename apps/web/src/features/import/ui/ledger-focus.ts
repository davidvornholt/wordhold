import { useEffect, useRef, useState } from 'react';
import { ledgerFieldAttribute } from './ledger-keyboard';

// Where focus goes once the ledger has rendered a change, so keyboard users
// never lose their place when the control they used disappears.
export type FocusRequest =
  | {
      readonly kind: 'term' | 'remove' | 'split' | 'unit';
      readonly rowId: string;
    }
  | { readonly kind: 'add' };

const focusSelector = (request: FocusRequest): string => {
  switch (request.kind) {
    case 'term':
      return `[data-row-id="${request.rowId}"] [${ledgerFieldAttribute}="target"]`;
    case 'remove':
      return `[data-row-id="${request.rowId}"] [data-row-remove]`;
    case 'split':
      return `[data-row-id="${request.rowId}"] [data-row-split]`;
    case 'unit':
      return `[data-section-start="${request.rowId}"] select`;
    default:
      return '[data-ledger-add]';
  }
};

// Focus requested during an event lands once React has rendered the rows
// the request names.
export const useLedgerFocus = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [request, setRequest] = useState<FocusRequest | null>(null);
  useEffect(() => {
    if (request === null) {
      return;
    }
    setRequest(null);
    formRef.current
      ?.querySelector<HTMLElement>(focusSelector(request))
      ?.focus();
  }, [request]);
  return { formRef, requestFocus: setRequest };
};

// After a removal the next row takes the removed row's place, or the row
// above when it was the last; an emptied ledger offers to add a row.
export const focusAfterRemoval = (
  rows: ReadonlyArray<{ readonly rowId: string }>,
  index: number,
): FocusRequest => {
  const neighbour = rows[index] ?? rows[index - 1];
  return neighbour === undefined
    ? { kind: 'add' }
    : { kind: 'remove', rowId: neighbour.rowId };
};
