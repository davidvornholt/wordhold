import {
  createFileRoute,
  useNavigate,
  useRouter,
} from '@tanstack/react-router';
import {
  defaultUsagePeriod,
  parsePeopleSearch,
} from '../../features/people/schemas/people-models';
import {
  getUsage,
  invitePerson,
  issueAccessCode,
  listPeople,
  removePerson,
  setPersonAccess,
  withdrawAccessCode,
} from '../../features/people/services/server-fns';
import { PeopleScreen } from '../../features/people/ui/people-screen';
import { ActionLink } from '../../shared/ui/action-link';
import { BackLink } from '../../shared/ui/back-link';
import { PageLayout } from '../../shared/ui/page-layout';

const People = () => {
  const { people, usage, period } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate({ from: Route.fullPath });

  return (
    <PageLayout
      backControl={<BackLink to="/">Übersicht</BackLink>}
      title="Personen"
    >
      <PeopleScreen
        invite={async (name) => {
          const issued = await invitePerson({ data: { name } });
          await router.invalidate();
          return issued;
        }}
        issueCode={async (person) => {
          const issued = await issueAccessCode({ data: person.userId });
          await router.invalidate();
          return issued;
        }}
        joinLink={(code) => `${globalThis.location.origin}/join#${code}`}
        onPeriodChange={(days) =>
          navigate({
            search: days === defaultUsagePeriod ? {} : { days },
            replace: true,
          })
        }
        people={people}
        period={period}
        remove={async (person) => {
          await removePerson({ data: person.userId });
          await router.invalidate();
        }}
        renderInspectLink={(person) => (
          <ActionLink
            params={{ userId: person.userId }}
            to="/people/$userId"
            variant="quiet"
          >
            Lernstand ansehen
          </ActionLink>
        )}
        setAccess={async (person, enabled) => {
          await setPersonAccess({ data: { userId: person.userId, enabled } });
          await router.invalidate();
        }}
        usage={usage}
        withdrawCode={async (person) => {
          await withdrawAccessCode({ data: person.userId });
          await router.invalidate();
        }}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/people/')({
  validateSearch: parsePeopleSearch,
  loaderDeps: ({ search }) => ({ days: search.days ?? defaultUsagePeriod }),
  loader: async ({ deps }) => {
    const [people, usage] = await Promise.all([
      listPeople(),
      getUsage({ data: deps.days }),
    ]);
    return { people, usage, period: deps.days };
  },
  component: People,
});
