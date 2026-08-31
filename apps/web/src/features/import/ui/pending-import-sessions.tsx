import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { countNoun } from '../../../shared/format/count';
import { Button } from '../../../shared/ui/button';
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
    } catch {
      setError(
        'Der Stapel konnte nicht gelöscht werden. Versuche es noch einmal.',
      );
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
          const label = `${session.courseName}, ${countNoun(
            session.pageCount,
            'Seite',
            'Seiten',
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
                {confirming ? (
                  <fieldset className="flex flex-col gap-3 border-destructive border-l-4 bg-destructive/10 p-3 text-sm">
                    <legend className="float-left">
                      {countNoun(session.pendingCount, 'Seite', 'Seiten')} und
                      die Fotos werden endgültig gelöscht.
                    </legend>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        disabled={discarding}
                        onClick={() => discardSession(session)}
                        ref={confirmationActionRef}
                        variant="destructive"
                      >
                        {discarding ? 'Wird gelöscht …' : 'Endgültig löschen'}
                      </Button>
                      <Button
                        disabled={discarding}
                        onClick={() => {
                          restoreFocusIdRef.current = session.id;
                          setConfirmingId(null);
                        }}
                        variant="quiet"
                      >
                        Behalten
                      </Button>
                    </div>
                  </fieldset>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    {renderSessionAction(session, label)}
                    <Button
                      aria-label={`${label} löschen`}
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
                      variant="quiet-muted"
                    >
                      Stapel löschen
                    </Button>
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
