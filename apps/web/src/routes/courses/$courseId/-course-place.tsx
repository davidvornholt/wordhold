import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import {
  type CourseOutline,
  unitsByBook,
  type WordProgress,
} from '../../../features/courses/schemas/course-units';
import { selectedEntryIds } from '../../../features/practice/schemas/session-request';
import type {
  PlaceSelectionData,
  VocabularySelectionData,
} from '../../../shared/session/vocabulary-selection';
import { ActionLink } from '../../../shared/ui/action-link';
import type { ActionVariant } from '../../../shared/ui/action-styles';
import { BackLink } from '../../../shared/ui/back-link';

// The words directly in one book, or one unit: what a learn, practice or
// study screen covers when it is opened from that book's or unit's page.
export type CoursePlace = WordProgress & {
  readonly selection: PlaceSelectionData;
  readonly name: string;
};

// Every place in course order: each book's own words, then its units.
export const coursePlaces = (
  outline: CourseOutline,
): ReadonlyArray<CoursePlace> =>
  unitsByBook(outline.books, outline.units).flatMap(({ book, units }) => [
    { ...book, selection: { bookId: book.id } },
    ...units.map((unit) => ({ ...unit, selection: { unitId: unit.id } })),
  ]);

export const findCoursePlace = (
  outline: CourseOutline,
  search: { readonly book?: string; readonly unit?: string },
): CoursePlace | undefined =>
  coursePlaces(outline).find(({ selection }) =>
    'bookId' in selection
      ? selection.bookId === search.book
      : selection.unitId === search.unit,
  );

// A book or unit named in the search wins over a hand-picked list of words,
// given as comma-separated entry IDs.
export const courseSelection = (
  place: CoursePlace | undefined,
  entries: string | undefined,
): VocabularySelectionData | null => {
  if (place !== undefined) {
    return place.selection;
  }
  const [first, ...rest] = selectedEntryIds(entries);
  return first === undefined ? null : { entryIds: [first, ...rest] };
};

// The search parameters that narrow practice or study to a place. Without a
// place they cover the whole course, as a subject's list does.
export const placeSearch = (selection: PlaceSelectionData | null) => {
  if (selection === null) {
    return { book: undefined, unit: undefined };
  }
  return 'bookId' in selection
    ? { book: selection.bookId, unit: undefined }
    : { book: undefined, unit: selection.unitId };
};

type PlaceLinkProps = {
  readonly courseId: string;
  // Null for the whole course, whose page is the course page.
  readonly selection: PlaceSelectionData | null;
  readonly children: ReactNode;
};

export const PlaceBackLink = ({
  courseId,
  selection,
  children,
}: PlaceLinkProps) => {
  if (selection === null) {
    return (
      <BackLink params={{ courseId }} to="/courses/$courseId">
        {children}
      </BackLink>
    );
  }
  return 'bookId' in selection ? (
    <BackLink
      params={{ courseId, bookId: selection.bookId }}
      to="/courses/$courseId/books/$bookId"
    >
      {children}
    </BackLink>
  ) : (
    <BackLink
      params={{ courseId, unitId: selection.unitId }}
      to="/courses/$courseId/units/$unitId"
    >
      {children}
    </BackLink>
  );
};

export const PlacePageLink = ({
  courseId,
  selection,
  variant,
  children,
}: PlaceLinkProps & { readonly variant: ActionVariant }) => {
  if (selection === null) {
    return (
      <ActionLink
        params={{ courseId }}
        to="/courses/$courseId"
        variant={variant}
      >
        {children}
      </ActionLink>
    );
  }
  return 'bookId' in selection ? (
    <ActionLink
      params={{ courseId, bookId: selection.bookId }}
      to="/courses/$courseId/books/$bookId"
      variant={variant}
    >
      {children}
    </ActionLink>
  ) : (
    <ActionLink
      params={{ courseId, unitId: selection.unitId }}
      to="/courses/$courseId/units/$unitId"
      variant={variant}
    >
      {children}
    </ActionLink>
  );
};

type PlaceLearnLinkProps = PlaceLinkProps & {
  readonly direction: AnswerDirection | undefined;
  readonly variant?: ActionVariant;
  readonly className?: string;
  readonly onClick?: () => void;
};

const placeLearnTarget = (
  courseId: string,
  selection: PlaceSelectionData | null,
) => {
  if (selection === null) {
    return { to: '/courses/$courseId/learn', params: { courseId } } as const;
  }
  return 'bookId' in selection
    ? ({
        to: '/courses/$courseId/books/$bookId/learn',
        params: { courseId, bookId: selection.bookId },
      } as const)
    : ({
        to: '/courses/$courseId/units/$unitId/learn',
        params: { courseId, unitId: selection.unitId },
      } as const);
};

export const PlaceLearnLink = ({
  courseId,
  selection,
  direction,
  variant,
  className,
  onClick,
  children,
}: PlaceLearnLinkProps) => (
  <ActionLink
    className={className}
    onClick={onClick}
    search={{ direction }}
    variant={variant}
    {...placeLearnTarget(courseId, selection)}
  >
    {children}
  </ActionLink>
);
