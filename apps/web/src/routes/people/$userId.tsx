import { createFileRoute } from '@tanstack/react-router';
import { getPersonProgress } from '../../features/dashboard/services/server-fns';
import { ProgressOverview } from '../../features/dashboard/ui/progress-overview';
import { getPerson } from '../../features/people/services/server-fns';
import { BackLink } from '../../shared/ui/back-link';
import { PageLayout } from '../../shared/ui/page-layout';

const PersonProgress = () => {
  const { person, progress } = Route.useLoaderData();
  return (
    <PageLayout
      backControl={<BackLink to="/people">Personen</BackLink>}
      title={`Lernstand von ${person.name}`}
    >
      <ProgressOverview
        courses={progress.courses}
        dashboard={progress.dashboard}
        name={person.name}
      />
    </PageLayout>
  );
};

export const Route = createFileRoute('/people/$userId')({
  loader: async ({ params }) => {
    const [person, progress] = await Promise.all([
      getPerson({ data: params.userId }),
      getPersonProgress({ data: params.userId }),
    ]);
    return { person, progress };
  },
  component: PersonProgress,
});
