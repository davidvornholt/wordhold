import { createFileRoute } from '@tanstack/react-router';
import { parsePracticeSearch } from '../../../features/practice/schemas/session-request';
import { focusShell } from '../../../shared/routing/shell';
import { LearnScreen, loadLearnScreen } from './-learn-screen';

// Learning a whole course at once, as a subject's terms are learned.
const LearnCourseScreen = () => <LearnScreen {...Route.useLoaderData()} />;

export const Route = createFileRoute('/courses/$courseId/learn')({
  staticData: focusShell,
  validateSearch: parsePracticeSearch,
  loaderDeps: ({ search }) => ({ direction: search.direction }),
  loader: ({ params, deps }) =>
    loadLearnScreen(params.courseId, null, deps.direction),
  component: LearnCourseScreen,
});
