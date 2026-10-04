import { useState } from 'react';
import type { DashboardData } from '../src/features/dashboard/schemas/dashboard-models';
import { ProgressOverview } from '../src/features/dashboard/ui/progress-overview';
import type {
  IssuedCode,
  Person,
  UsagePeriod,
  UsageRow,
} from '../src/features/people/schemas/people-models';
import { PeopleScreen } from '../src/features/people/ui/people-screen';
import { PageLayout } from '../src/shared/ui/page-layout';
import { fixtureBackControl, fixtureControl } from './fixture-controls';

const now = new Date('2026-08-24T17:00:00Z');
const tomorrow = new Date('2026-08-25T17:00:00Z');

const fixturePeople: ReadonlyArray<Person> = [
  {
    userId: 'admin',
    name: 'David',
    admin: true,
    enabled: true,
    registered: true,
    code: null,
    lastActiveAt: now,
  },
  {
    userId: 'anna',
    name: 'Anna',
    admin: false,
    enabled: true,
    registered: true,
    code: null,
    lastActiveAt: new Date('2026-08-23T08:15:00Z'),
  },
  {
    userId: 'ben',
    name: 'Ben',
    admin: false,
    enabled: true,
    registered: false,
    code: { kind: 'invitation', expiresAt: tomorrow },
    lastActiveAt: null,
  },
  {
    userId: 'clara',
    name: 'Clara',
    admin: false,
    enabled: false,
    registered: true,
    code: null,
    lastActiveAt: new Date('2026-07-02T19:40:00Z'),
  },
];

const usageRow = (row: Partial<UsageRow>): UsageRow => ({
  userId: 'anna',
  name: 'Anna',
  operation: 'page-extraction',
  provider: 'bedrock',
  model: 'claude-sonnet-5-5',
  requests: 1,
  failed: 0,
  unknownCost: 0,
  estimatedUsd: 0,
  ...row,
});

const fixtureUsage: ReadonlyArray<UsageRow> = [
  usageRow({ requests: 12, estimatedUsd: 0.4321 }),
  usageRow({
    operation: 'answer-grading',
    model: 'claude-haiku-4-5',
    requests: 86,
    failed: 2,
    estimatedUsd: 0.0912,
  }),
  usageRow({
    operation: 'speech',
    provider: 'polly',
    model: 'neural',
    requests: 40,
    unknownCost: 3,
    estimatedUsd: 0.0215,
  }),
  usageRow({
    userId: 'admin',
    name: 'David',
    requests: 30,
    estimatedUsd: 1.084,
  }),
  usageRow({
    userId: null,
    name: null,
    operation: 'definition-grading',
    model: 'claude-haiku-4-5',
    requests: 5,
    estimatedUsd: 0.004,
  }),
];

const issue = (person: Person, code: string): IssuedCode => ({
  userId: person.userId,
  name: person.name,
  kind: person.registered ? 'recovery' : 'invitation',
  code,
  expiresAt: tomorrow,
});

export const PeopleFixture = () => {
  const [people, setPeople] = useState(fixturePeople);
  const [period, setPeriod] = useState<UsagePeriod>(30);
  const update = (userId: string, change: (person: Person) => Person) =>
    setPeople((current) =>
      current.map((person) =>
        person.userId === userId ? change(person) : person,
      ),
    );

  return (
    <PageLayout
      backControl={fixtureBackControl('Übersicht', 'dashboard')}
      title="Personen"
    >
      <PeopleScreen
        invite={(name) => {
          const person: Person = {
            userId: `invited-${people.length}`,
            name,
            admin: false,
            enabled: true,
            registered: false,
            code: { kind: 'invitation', expiresAt: tomorrow },
            lastActiveAt: null,
          };
          setPeople((current) => [...current, person]);
          return Promise.resolve(
            issue(person, 'pX8f2LqZr4Tn7VbW1cYk9HsD3mJa6UeG0oRiQyNt5Ew'),
          );
        }}
        issueCode={(person) => {
          const issued = issue(
            person,
            'vB4n8RtY2mLw5QxK9pJc1HsF7aZd3UeG6oTiXyNq0Sw',
          );
          update(person.userId, (current) => ({
            ...current,
            code: { kind: issued.kind, expiresAt: issued.expiresAt },
          }));
          return Promise.resolve(issued);
        }}
        joinLink={(code) => `https://wordhold.example/join#${code}`}
        onPeriodChange={setPeriod}
        people={people}
        period={period}
        remove={async (person) =>
          setPeople((current) =>
            current.filter((candidate) => candidate.userId !== person.userId),
          )
        }
        renderInspectLink={() =>
          fixtureControl('Lernstand ansehen', 'people-progress', 'quiet')
        }
        setAccess={async (person, enabled) =>
          update(person.userId, (current) => ({
            ...current,
            enabled,
            code: enabled ? current.code : null,
          }))
        }
        usage={fixtureUsage}
        withdrawCode={async (person) =>
          update(person.userId, (current) => ({ ...current, code: null }))
        }
      />
    </PageLayout>
  );
};

const languageId = '00000000-0000-0000-0000-000000000101';
const subjectId = '00000000-0000-0000-0000-000000000102';

const progress: DashboardData = {
  perCourse: [
    {
      courseId: languageId,
      due: 4,
      firstReviews: 2,
      ready: 6,
      unintroduced: 10,
      entries: 48,
      known: 21,
      nextDueAt: now,
      directions: [],
    },
  ],
  fragile: [
    {
      entryId: '00000000-0000-0000-0000-000000000201',
      courseId: languageId,
      courseKind: 'language',
      targetText: 'though',
      nativeText: 'obwohl',
      courseName: 'Englisch',
      failures: 3,
    },
  ],
  reviewsToday: 9,
  cardsToday: 6,
  week: [
    { day: '2026-08-18', weekday: 2, practiced: true },
    { day: '2026-08-19', weekday: 3, practiced: false },
    { day: '2026-08-20', weekday: 4, practiced: true },
    { day: '2026-08-21', weekday: 5, practiced: true },
    { day: '2026-08-22', weekday: 6, practiced: false },
    { day: '2026-08-23', weekday: 0, practiced: true },
    { day: '2026-08-24', weekday: 1, practiced: true },
  ],
  streak: 2,
};

export const PeopleProgressFixture = () => (
  <PageLayout
    backControl={fixtureBackControl('Personen', 'people')}
    title="Lernstand von Anna"
  >
    <ProgressOverview
      courses={[
        {
          id: languageId,
          name: 'Englisch',
          kind: 'language',
          targetLanguage: 'en',
        },
        {
          id: subjectId,
          name: 'Biologie',
          kind: 'terms',
          targetLanguage: 'de',
        },
      ]}
      dashboard={progress}
      name="Anna"
    />
  </PageLayout>
);
