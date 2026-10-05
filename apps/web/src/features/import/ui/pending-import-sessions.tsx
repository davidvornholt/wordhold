import type { ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { ProgressMeter } from '../../../shared/ui/progress-meter';

type PendingImportSession = {
  readonly id: string;
  readonly courseId: string;
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
  // Where focus goes once the last batch is discarded and the list is gone.
  readonly fallbackFocusRef: RefObject<HTMLElement | null>;
};

const progressLabel = (
  session: Pick<
    PendingImportSession,
    'isComplete' | 'pendingCount' | 'uploadedCount' | 'pageCount'
  >,
): string =>
  session.isComplete
    ? `${countNoun(session.pendingCount, 'Seite', 'Seiten')} noch zu prüfen`
    : `${session.uploadedCount} von ${countNoun(session.pageCount, 'Seite', 'Seiten')} verarbeitet`;

export const PendingImportSessions = ({
  sessions,
  renderSessionAction,
  onDiscard,
  fallbackFocusRef,
}: PendingImportSessionsProps) => {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirming = sessions.find((session) => session.id === confirmingId);
  // A discarded batch takes its delete button with it, and the last one the
  // whole list, so once the batch is gone, focus goes to the list heading or
  // to fallbackFocusRef instead of the page body.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const discardedRef = useRef<string | null>(null);
  useEffect(() => {
    const discarded = discardedRef.current;
    if (
      discarded !== null &&
      !sessions.some((session) => session.id === discarded)
    ) {
      discardedRef.current = null;
      (sessions.length === 0 ? fallbackFocusRef : headingRef).current?.focus();
    }
  }, [sessions, fallbackFocusRef]);

  if (sessions.length === 0) {
    return null;
  }

  const discardSession = async (
    session: PendingImportSession,
  ): Promise<void> => {
    setDiscardingId(session.id);
    setError(null);
    discardedRef.current = session.id;
    try {
      await onDiscard(session);
    } catch {
      discardedRef.current = null;
      setError(
        'Der Stapel konnte nicht gelöscht werden. Versuche es noch einmal.',
      );
    } finally {
      setConfirmingId(null);
      setDiscardingId(null);
    }
  };

  return (
    <section className="flex flex-col gap-4" data-testid="open-imports">
      <div className="flex flex-col gap-1">
        <h2
          className="font-display text-xl focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          ref={headingRef}
          tabIndex={-1}
        >
          Offene Importe
        </h2>
        <p className="text-muted-foreground text-sm">
          Jeder Stapel bleibt erhalten, bis alle Seiten geprüft sind.
        </p>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2">
        {sessions.map((session) => {
          const label = `${session.courseName}, ${countNoun(
            session.pageCount,
            'Seite',
            'Seiten',
          )}, ${new Date(session.capturedAt).toLocaleDateString('de-DE')}`;
          return (
            <li className="relative mt-2 ml-2" key={session.id}>
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-2 -left-2 size-full border border-border bg-background"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-1 -left-1 size-full border border-border bg-card"
              />
              <div className="relative flex flex-col gap-3 border border-border bg-card p-4">
                <div>
                  <h3 className="font-display text-lg">{session.courseName}</h3>
                  <p className="text-muted-foreground text-sm">
                    {countNoun(session.pageCount, 'Seite', 'Seiten')} ·{' '}
                    {new Date(session.capturedAt).toLocaleDateString('de-DE')}
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm">{progressLabel(session)}</p>
                  <ProgressMeter
                    accessibleName={`${session.verifiedCount} von ${session.pageCount} Seiten geprüft`}
                    total={session.pageCount}
                    value={session.verifiedCount}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {renderSessionAction(session, label)}
                  <Button
                    aria-label={`${label} löschen`}
                    disabled={discardingId !== null}
                    onClick={() => {
                      setError(null);
                      setConfirmingId(session.id);
                    }}
                    variant="quiet-muted"
                  >
                    Stapel löschen
                  </Button>
                </div>
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
      <ConfirmDialog
        busy={discardingId !== null}
        cancelLabel="Behalten"
        confirmLabel={
          discardingId === null ? 'Endgültig löschen' : 'Wird gelöscht …'
        }
        description={
          confirming === undefined
            ? ''
            : `${countNoun(confirming.pendingCount, 'Seite', 'Seiten')} und die Fotos werden endgültig gelöscht.`
        }
        onCancel={() => setConfirmingId(null)}
        onConfirm={() => {
          if (confirming !== undefined) {
            discardSession(confirming).catch(() => undefined);
          }
        }}
        open={confirming !== undefined}
        title={
          confirming === undefined
            ? 'Stapel löschen'
            : `${confirming.courseName}: Stapel löschen?`
        }
      />
    </section>
  );
};
