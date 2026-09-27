import { createFileRoute } from '@tanstack/react-router';
import { parsePracticeSearch } from '../../../../../features/practice/schemas/session-request';
import { focusShell } from '../../../../../shared/routing/shell';
import { LearnScreen, loadLearnScreen } from '../../-learn-screen';

const LearnBookScreen = () => <LearnScreen {...Route.useLoaderData()} />;

export const Route = createFileRoute('/courses/$courseId/books/$bookId/learn')({
  staticData: focusShell,
  validateSearch: parsePracticeSearch,
  loaderDeps: ({ search }) => ({ direction: search.direction }),
  loader: ({ params, deps }) =>
    loadLearnScreen(params.courseId, { bookId: params.bookId }, deps.direction),
  component: LearnBookScreen,
});
