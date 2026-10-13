import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import {
  parseVocabularySearch,
  type VocabularySearchData,
} from '../../../features/courses/schemas/vocabulary-search';
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
import { isListCourse } from '../../../shared/directions';
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
  readonly list: VocabularySearchData;
};

// A round leads back to where its words were picked: their book's or unit's
// page, or the word list with its filter and place as they were, as a study
// sitting does.
const SentenceBackControl = ({ courseId, place, list }: SentenceOriginProps) =>
  place === undefined ? (
    <BackLink
      params={{ courseId }}
      search={{ filter: list.filter ?? 'all', place: list.place }}
      to="/courses/$courseId/vocabulary"
    >
      Vokabelliste
    </BackLink>
  ) : (
    <PlaceBackLink
      courseId={courseId}
      filter={list.filter}
      selection={place.selection}
    >
      {place.name}
    </PlaceBackLink>
  );

const SentenceSelectionControl = ({
  courseId,
  place,
  list,
}: SentenceOriginProps) =>
  place === undefined ? (
    <ActionLink
      params={{ courseId }}
      search={{ filter: list.filter ?? 'all', place: list.place }}
      to="/courses/$courseId/vocabulary"
      variant="quiet-muted"
    >
      Neue Auswahl treffen
    </ActionLink>
  ) : (
    <PlacePageLink
      courseId={courseId}
      filter={list.filter}
      selection={place.selection}
      variant="quiet-muted"
    >
      Zurück zu {place.name}
    </PlacePageLink>
  );

const SentenceScreen = () => {
  const { course, picked, place, session } = Route.useLoaderData();
  const search = Route.useSearch();
  const origin = {
    courseId: course.id,
    place,
    list: { filter: search.filter, place: search.place },
  };
  const router = useRouter();
  const [roundGeneration, setRoundGeneration] = useState(0);

  return (
    <FocusLayout
      exit={<SentenceBackControl {...origin} />}
      title={`${picked || place === undefined ? 'Auswahl' : place.name} · Sätze übersetzen`}
    >
      <SentenceRunner
        backControl={<SentenceSelectionControl {...origin} />}
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
  // The list's filter and place only lead back to it.
  validateSearch: (input: unknown) => ({
    ...parseVocabularySearch(input),
    ...parseSentenceSearch(input),
  }),
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
    if (isListCourse(course.kind) || selection === null) {
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
    // Words picked by hand are a selection of their own, even when they
    // were picked on a book's or unit's page.
    return { course, picked: 'entryIds' in selection, place, session };
  },
  component: SentenceScreen,
});
