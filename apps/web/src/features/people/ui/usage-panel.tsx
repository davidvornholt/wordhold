import { useId } from 'react';
import { countNoun } from '../../../shared/format/count';
import { fieldClass } from '../../../shared/ui/field-styles';
import { cardListClass } from '../../../shared/ui/surface-styles';
import {
  costsPerPerson,
  deletedPersonName,
  formatUsd,
  operationLabel,
} from '../schemas/people-labels';
import {
  type UsagePeriod,
  type UsageRow,
  usagePeriods,
} from '../schemas/people-models';

type UsagePanelProps = {
  readonly rows: ReadonlyArray<UsageRow>;
  readonly period: UsagePeriod;
  readonly onPeriodChange: (period: UsagePeriod) => void;
};

const cellClass = 'border-border border-b px-3 py-2';

const unknownNote = (count: number): string =>
  count === 0
    ? ''
    : ` · ${countNoun(count, 'Anfrage', 'Anfragen')} ohne bekannte Kosten`;

export const UsagePanel = ({
  rows,
  period,
  onPeriodChange,
}: UsagePanelProps) => {
  const id = useId();
  const people = costsPerPerson(rows);
  const total = people.reduce((sum, person) => sum + person.estimatedUsd, 0);
  const unknown = people.reduce((sum, person) => sum + person.unknownCost, 0);

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl" id={`${id}-heading`}>
          KI-Kosten
        </h2>
        <label className="flex flex-col gap-1 text-sm">
          Zeitraum
          <select
            className={fieldClass}
            onChange={(event) => {
              const next = usagePeriods.find(
                (days) => String(days) === event.target.value,
              );
              if (next !== undefined) {
                onPeriodChange(next);
              }
            }}
            value={period}
          >
            {usagePeriods.map((days) => (
              <option key={days} value={days}>
                Letzte {days} Tage
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Geschätzt {formatUsd(total)}
        {unknownNote(unknown)}
      </p>
      <p className="max-w-prose text-muted-foreground text-sm">
        Die Schätzung rechnet die gemeldete Nutzung mit den Preisen zum
        Zeitpunkt der Anfrage. Maßgeblich ist die Rechnung von AWS. Ohne
        gemeldete Nutzung bleiben die Kosten unbekannt statt null.
      </p>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          In diesem Zeitraum gab es keine KI-Anfragen.
        </p>
      ) : (
        <>
          <ul className={cardListClass}>
            {people.map((person) => (
              <li
                className="flex flex-wrap justify-between gap-x-4 px-4 py-3"
                key={person.key}
              >
                <span>{person.name}</span>
                <span className="text-muted-foreground text-sm">
                  {formatUsd(person.estimatedUsd)} ·{' '}
                  {countNoun(person.requests, 'Anfrage', 'Anfragen')}
                  {unknownNote(person.unknownCost)}
                </span>
              </li>
            ))}
          </ul>
          <section
            aria-label="KI-Anfragen nach Person und Vorgang"
            className="overflow-x-auto"
            // biome-ignore lint/a11y/noNoninteractiveTabindex: The table scrolls sideways on narrow screens and must be reachable by keyboard.
            tabIndex={0}
          >
            <table className="w-full min-w-xl text-left text-sm">
              <caption className="sr-only">
                KI-Anfragen nach Person, Vorgang und Modell
              </caption>
              <thead>
                <tr>
                  {[
                    'Person',
                    'Vorgang',
                    'Modell',
                    'Anfragen',
                    'Fehlgeschlagen oder offen',
                    'Geschätzt',
                  ].map((heading) => (
                    <th className={cellClass} key={heading} scope="col">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.userId ?? 'deleted'}-${row.operation}-${row.provider}-${row.model}`}
                  >
                    <th className={`${cellClass} font-normal`} scope="row">
                      {row.name ?? deletedPersonName}
                    </th>
                    <td className={cellClass}>
                      {operationLabel(row.operation)}
                    </td>
                    <td className={cellClass}>{row.model}</td>
                    <td className={cellClass}>{row.requests}</td>
                    <td className={cellClass}>{row.failed}</td>
                    <td className={cellClass}>
                      {formatUsd(row.estimatedUsd)}
                      {row.unknownCost === 0
                        ? ''
                        : ` (${row.unknownCost} unbekannt)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}
    </section>
  );
};
