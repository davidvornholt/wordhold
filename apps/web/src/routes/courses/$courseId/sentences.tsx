import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import {
  getCourseOutline,
  prepareVocabularyExamples,
} from '../../../features/courses/services/server-fns';
import { getCourse } from '../../../features/import/server-fns';
import { parseSentenceSearch } from '../../../features/practice/schemas/sentence-models';
import {
  checkSentence,
  getSentenceSession,
} from '../../../features/practice/services/sentence-server-fns';
import { SentenceRunner } from '../../../features/practice/ui/sentence-runner';
import { focusShell } from '../../../shared/routing/shell';
import { ActionLink } from '../../../shared/ui/action-link';
import { BackLink } from '../../../shared/ui/back-link';
import { Button } from '../../../shared/ui/button';
import { FocusLayout } from '../../../shared/ui/focus-layout';
import {
  type CoursePlace,
  courseSelection,
  findCoursePlace,
  PlaceBackLink,
  PlacePageLink,
} from './-course-place';

type SentenceOriginProps = {
  readonly courseId: string;
  readonly place: CoursePlace | undefined;
};

// Hand-picked words have no one book or unit to return to, so a round of
// them leads to the word list, as a study sitting of picked words does.
const SentenceBackControl = ({ courseId, place }: SentenceOriginProps) =>
  place === undefined ? (
    <BackLink
      params={{ courseId }}
      search={{ filter: 'all' }}
      to="/courses/$courseId/vocabulary"
    >
      Vokabelliste
    </BackLink>
  ) : (
    <PlaceBackLink courseId={courseId} selection={place.selection}>
      {place.name}
    </PlaceBackLink>
  );

const SentenceSelectionControl = ({ courseId, place }: SentenceOriginProps) =>
  place === undefined ? (
    <ActionLink
      params={{ courseId }}
      search={{ filter: 'all' }}
      to="/courses/$courseId/vocabulary"
      variant="quiet-muted"
    >
      Neue Auswahl treffen
    </ActionLink>
  ) : (
    <PlacePageLink
      courseId={courseId}
      selection={place.selection}
      variant="quiet-muted"
    >
      Zurück zu {place.name}
    </PlacePageLink>
  );

const SentenceScreen = () => {
  const { course, place, session } = Route.useLoaderData();
  const router = useRouter();
  const [roundGeneration, setRoundGeneration] = useState(0);

  return (
    <FocusLayout
      exit={<SentenceBackControl courseId={course.id} place={place} />}
      title={`${place?.name ?? 'Auswahl'} · Sätze übersetzen`}
    >
      <SentenceRunner
        backControl={
          <SentenceSelectionControl courseId={course.id} place={place} />
        }
        check={checkSentence}
        continueControl={
          <Button
            onClick={async () => {
              await router.invalidate();
              setRoundGeneration((current) => current + 1);
            }}
          >
            Noch eine Runde
          </Button>
        }
        key={`${roundGeneration}-${session.items
          .map((item) => item.entryId)
          .join('|')}`}
        prepareExamples={prepareVocabularyExamples}
        session={session}
        targetLanguage={course.targetLanguage}
      />
    </FocusLayout>
  );
};

export const Route = createFileRoute('/courses/$courseId/sentences')({
  staticData: focusShell,
  validateSearch: parseSentenceSearch,
  loaderDeps: ({ search }) => ({
    book: search.book,
    unit: search.unit,
    entries: search.entries,
  }),
  loader: async ({ params, deps }) => {
    const [course, outline] = await Promise.all([
      getCourse({ data: params.courseId }),
      getCourseOutline({ data: params.courseId }),
    ]);
    const place = findCoursePlace(outline, deps);
    const selection = courseSelection(place, deps.entries);
    // Sentences come from a language course's example sentences, and a
    // round is drawn from the book, unit or words it was opened from.
    if (course.kind === 'terms' || selection === null) {
      throw redirect({
        to: '/courses/$courseId',
        params: { courseId: course.id },
        search: {},
      });
    }
    // Example sentences are prepared once the round is on screen, as in
    // card practice.
    const session = await getSentenceSession({
      data: { courseId: course.id, selection },
    });
    return { course, place, session };
  },
  component: SentenceScreen,
});
