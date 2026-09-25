import { useState } from 'react';
import type { DraftEntry } from '../src/features/import/ui/entry-row';
import { VerifyForm } from '../src/features/import/ui/verify-form';

const entries: ReadonlyArray<DraftEntry> = [
  {
    targetText: 'memory',
    nativeText: 'Erinnerung',
    example: '',
    exampleNativeText: '',
  },
];

const book = {
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Green Line 3',
  lastImportedAt: null,
};

const units = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    bookId: book.id,
    name: 'Unit 3',
    position: 1,
    isHolding: false,
    entryCount: 12,
  },
];

export const StaleUnitVerificationFixture = () => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <main className="page-column flex flex-col gap-4 p-6">
      <h1 className="font-display font-semibold text-2xl">Seite überprüfen</h1>
      {error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
      <VerifyForm
        books={[book]}
        busy={busy}
        existingEntries={[]}
        generateExample={async () => ({
          target: 'This memory makes me smile.',
          native: 'Diese Erinnerung bringt mich zum Lächeln.',
        })}
        translateExample={async () => ({ native: 'Übersetzt.' })}
        initialEntries={entries}
        initialUnitName="Unit 3"
        onSubmit={() => {
          setBusy(true);
          setError(null);
          queueMicrotask(() => {
            setError('Diese Einheit gibt es nicht mehr. Lade die Seite neu.');
            setBusy(false);
          });
        }}
        targetLabel="Englisch"
        units={units}
      />
    </main>
  );
};
