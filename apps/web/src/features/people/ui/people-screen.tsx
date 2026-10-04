import { type ReactNode, useState } from 'react';
import { cardClass, cardListClass } from '../../../shared/ui/surface-styles';
import type {
  IssuedCode,
  Person,
  UsagePeriod,
  UsageRow,
} from '../schemas/people-models';
import { AccessCodePanel } from './access-code-panel';
import { InviteForm } from './invite-form';
import { PersonRow } from './person-row';
import { UsagePanel } from './usage-panel';

type PeopleScreenProps = {
  readonly people: ReadonlyArray<Person>;
  readonly usage: ReadonlyArray<UsageRow>;
  readonly period: UsagePeriod;
  readonly onPeriodChange: (period: UsagePeriod) => void;
  readonly renderInspectLink: (person: Person) => ReactNode;
  // The page that redeems a code, as a link to send.
  readonly joinLink: (code: string) => string;
  readonly invite: (name: string) => Promise<IssuedCode>;
  readonly issueCode: (person: Person) => Promise<IssuedCode>;
  readonly withdrawCode: (person: Person) => Promise<void>;
  readonly setAccess: (person: Person, enabled: boolean) => Promise<void>;
  readonly remove: (person: Person) => Promise<void>;
};

export const PeopleScreen = ({
  people,
  usage,
  period,
  onPeriodChange,
  renderInspectLink,
  joinLink,
  invite,
  issueCode,
  withdrawCode,
  setAccess,
  remove,
}: PeopleScreenProps) => {
  const [issued, setIssued] = useState<IssuedCode | null>(null);
  // A link for someone whose code was withdrawn or replaced no longer works.
  const forget = (person: Person) =>
    setIssued((current) =>
      current?.userId === person.userId ? null : current,
    );

  return (
    <div className="flex flex-col gap-10">
      <p className="max-w-prose text-muted-foreground">
        Lade Familienmitglieder ein. Jede Person meldet sich mit einem Passkey
        an und hat eigene Sprachen und Fächer. Du kannst ihren Lernstand
        ansehen, aber nichts darin ändern.
      </p>
      <section className={`${cardClass} flex flex-col gap-4`}>
        <h2 className="font-display text-xl">Person einladen</h2>
        <InviteForm
          invite={async (name) => {
            setIssued(await invite(name));
          }}
        />
      </section>
      {issued === null ? null : (
        <AccessCodePanel
          issued={issued}
          key={issued.code}
          link={joinLink(issued.code)}
          onHide={() => setIssued(null)}
        />
      )}
      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl">Personen</h2>
        <ul className={cardListClass}>
          {people.map((person) => (
            <PersonRow
              actions={{
                issueCode: async (target) => {
                  setIssued(await issueCode(target));
                },
                withdrawCode: async (target) => {
                  await withdrawCode(target);
                  forget(target);
                },
                setAccess: async (target, enabled) => {
                  await setAccess(target, enabled);
                  if (!enabled) {
                    forget(target);
                  }
                },
                remove: async (target) => {
                  await remove(target);
                  forget(target);
                },
              }}
              inspectLink={renderInspectLink(person)}
              key={person.userId}
              person={person}
            />
          ))}
        </ul>
      </section>
      <UsagePanel
        onPeriodChange={onPeriodChange}
        period={period}
        rows={usage}
      />
    </div>
  );
};
