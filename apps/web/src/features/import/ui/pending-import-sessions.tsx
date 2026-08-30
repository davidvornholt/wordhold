import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

type PendingImportSession = {
  readonly id: string;
  readonly courseName: string;
  readonly capturedAt: Date;
  readonly pageCount: number;
  readonly uploadedCount: number;
  readonly verifiedCount: number;
  readonly pendingCount: number;
  readonly isComplete: boolean;
};

type PendingImportSessionsProps = {
  readonly sessions: ReadonlyArray<PendingImportSession>;
  readonly renderSessionAction: (
    session: PendingImportSession,
    label: string,
  ) => ReactNode;
  readonly onDiscard: (session: PendingImportSession) => Promise<void>;
};

const pageCountLabel = (count: number): string =>
  `${count} ${count === 1 ? 'Seite' : 'Seiten'}`;

const progressLabel = (
  session: Pick<
    PendingImportSession,
    'isComplete' | 'pendingCount' | 'uploadedCount' | 'pageCount'
  >,
): string => {
  if (!session.isComplete) {
    return `${session.uploadedCount} von ${session.pageCount} Seiten verarbeitet`;
  }
  return session.pendingCount === 1
    ? '1 Seite noch zu prüfen'
    : `${session.pendingCount} Seiten noch zu prüfen`;
};

export const PendingImportSessions = ({
  sessions,
  renderSessionAction,
  onDiscard,
}: PendingImportSessionsProps) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirmationActionRef = useRef<HTMLButtonElement>(null);
  const discardActionRefs = useRef(new Map<string, HTMLButtonElement>());
  const restoreFocusIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (confirmingId !== null) {
      confirmationActionRef.current?.focus();
      return;
    }
    const restoreFocusId = restoreFocusIdRef.current;
    if (restoreFocusId !== null) {
      discardActionRefs.current.get(restoreFocusId)?.focus();
      restoreFocusIdRef.current = null;
    }
  }, [confirmingId]);

  if (sessions.length === 0) {
    return null;
  }

  const discardSession = async (
    session: PendingImportSession,
  ): Promise<void> => {
    setDiscardingId(session.id);
    setError(null);
    try {
      await onDiscard(session);
      setConfirmingId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setDiscardingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-4" data-testid="open-imports">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl">Offene Importe</h2>
        <p className="text-muted-foreground text-sm">
          Jeder Stapel bleibt erhalten, bis alle Seiten geprüft sind.
        </p>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2">
        {sessions.map((session) => {
          const label = `${session.courseName}, ${pageCountLabel(
            session.pageCount,
          )}, ${new Date(session.capturedAt).toLocaleDateString('de-DE')}`;
          const confirming = confirmingId === session.id;
          const discarding = discardingId === session.id;
          return (
            <li className="relative mt-2 ml-2" key={session.id}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-2 -left-2 h-full w-full border border-border bg-background"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-1 -left-1 h-full w-full border border-border bg-card"
              />
              <div className="relative flex flex-col gap-3 border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-lg">
                      {session.courseName}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {pageCountLabel(session.pageCount)} ·{' '}
                      {new Date(session.capturedAt).toLocaleDateString('de-DE')}
                    </p>
                  </div>
                  <span className="border border-border px-2 py-1 font-medium text-sm">
                    {session.pageCount}
                    <span className="sr-only">
                      {' '}
                      {session.pageCount === 1 ? 'Seite' : 'Seiten'}
                    </span>
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm">{progressLabel(session)}</p>
                  <progress
                    aria-label={`${session.verifiedCount} von ${session.pageCount} Seiten geprüft`}
                    className="h-2 w-full accent-primary"
                    max={session.pageCount}
                    value={session.verifiedCount}
                  />
                </div>
                {confirming ? (
                  <fieldset className="flex flex-col gap-2 border-border border-l-4 pl-3 text-sm">
                    <legend>
                      {pageCountLabel(session.pendingCount)} und die Fotos
                      werden gelöscht.
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="border border-input px-3 py-2"
                        disabled={discarding}
                        onClick={() => discardSession(session)}
                        ref={confirmationActionRef}
                        type="button"
                      >
                        {discarding ? 'Wird gelöscht …' : 'Stapel löschen'}
                      </button>
                      <button
                        className="px-3 py-2 underline underline-offset-4"
                        disabled={discarding}
                        onClick={() => {
                          restoreFocusIdRef.current = session.id;
                          setConfirmingId(null);
                        }}
                        type="button"
                      >
                        Behalten
                      </button>
                    </div>
                  </fieldset>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {renderSessionAction(session, label)}
                    <button
                      aria-label={`${label} löschen`}
                      className="text-muted-foreground text-sm underline underline-offset-4"
                      disabled={discardingId !== null}
                      onClick={() => {
                        setError(null);
                        setConfirmingId(session.id);
                      }}
                      ref={(element) => {
                        if (element === null) {
                          discardActionRefs.current.delete(session.id);
                        } else {
                          discardActionRefs.current.set(session.id, element);
                        }
                      }}
                      type="button"
                    >
                      Stapel löschen
                    </button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {error === null ? null : (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </section>
  );
};
