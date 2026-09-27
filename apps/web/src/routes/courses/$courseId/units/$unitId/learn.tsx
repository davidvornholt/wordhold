import { createFileRoute } from '@tanstack/react-router';
import { parsePracticeSearch } from '../../../../../features/practice/schemas/session-request';
import { focusShell } from '../../../../../shared/routing/shell';
import { LearnScreen, loadLearnScreen } from '../../-learn-screen';

const LearnUnitScreen = () => <LearnScreen {...Route.useLoaderData()} />;

export const Route = createFileRoute('/courses/$courseId/units/$unitId/learn')({
  staticData: focusShell,
  validateSearch: parsePracticeSearch,
  loaderDeps: ({ search }) => ({ direction: search.direction }),
  loader: ({ params, deps }) =>
    loadLearnScreen(params.courseId, { unitId: params.unitId }, deps.direction),
  component: LearnUnitScreen,
});
