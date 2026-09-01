import { maximumUnitNameLength } from '@wordhold/ai/extraction/schema';
import { type SubmitEvent, useState } from 'react';
import { Button } from '../../../shared/ui/button';
import { fieldClass } from '../../../shared/ui/field-styles';
import type { CourseUnit } from '../schemas/course-units';

type NewUnitFormProps = {
  readonly busy: boolean;
  readonly units: ReadonlyArray<CourseUnit>;
  readonly createUnit: (name: string) => Promise<ReadonlyArray<CourseUnit>>;
  readonly onBusyChange: (busy: boolean) => void;
  readonly onCreated: (units: ReadonlyArray<CourseUnit>) => void;
};

export const NewUnitForm = ({
  busy,
  units,
  createUnit,
  onBusyChange,
  onCreated,
}: NewUnitFormProps) => {
  const [name, setName] = useState('');
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState('');

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (busy || trimmed === '') {
      return;
    }
    if (units.some((unit) => unit.name === trimmed)) {
      setFailed(true);
      setStatus(`Die Einheit "${trimmed}" gibt es bereits.`);
      return;
    }
    onBusyChange(true);
    setFailed(false);
    setStatus('Einheit wird hinzugefügt …');
    try {
      onCreated(await createUnit(trimmed));
      setName('');
      setStatus(`${trimmed} hinzugefügt.`);
    } catch {
      setFailed(true);
      setStatus(
        'Die Einheit wurde nicht hinzugefügt. Versuche es noch einmal.',
      );
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submit}>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          Neue Einheit
          <input
            className={fieldClass}
            disabled={busy}
            maxLength={maximumUnitNameLength}
            onChange={(event) => setName(event.target.value)}
            placeholder="z. B. Unité 2 Volet 1"
            value={name}
          />
        </label>
        <Button
          className="self-end"
          disabled={busy || name.trim() === ''}
          type="submit"
          variant="outline"
        >
          Einheit hinzufügen
        </Button>
      </form>
      <output
        aria-label="Status beim Hinzufügen einer Einheit"
        className={failed ? 'text-destructive text-sm' : 'text-sm'}
      >
        {status}
      </output>
    </>
  );
};
