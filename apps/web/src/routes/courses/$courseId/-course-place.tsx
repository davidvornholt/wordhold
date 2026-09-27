import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type { ReactNode } from 'react';
import {
  type CourseOutline,
  unitsByBook,
  type WordProgress,
} from '../../../features/courses/schemas/course-units';
import type { PlaceSelectionData } from '../../../shared/session/vocabulary-selection';
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

// The search parameters that narrow practice or study to a place.
export const placeSearch = (selection: PlaceSelectionData) =>
  'bookId' in selection
    ? { book: selection.bookId, unit: undefined }
    : { book: undefined, unit: selection.unitId };

type PlaceLinkProps = {
  readonly courseId: string;
  readonly selection: PlaceSelectionData;
  readonly children: ReactNode;
};

export const PlaceBackLink = ({
  courseId,
  selection,
  children,
}: PlaceLinkProps) =>
  'bookId' in selection ? (
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

export const PlacePageLink = ({
  courseId,
  selection,
  variant,
  children,
}: PlaceLinkProps & { readonly variant: ActionVariant }) =>
  'bookId' in selection ? (
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

type PlaceLearnLinkProps = PlaceLinkProps & {
  readonly direction: AnswerDirection | undefined;
  readonly variant?: ActionVariant;
  readonly className?: string;
  readonly onClick?: () => void;
};

export const PlaceLearnLink = ({
  courseId,
  selection,
  direction,
  variant,
  className,
  onClick,
  children,
}: PlaceLearnLinkProps) =>
  'bookId' in selection ? (
    <ActionLink
      className={className}
      onClick={onClick}
      params={{ courseId, bookId: selection.bookId }}
      search={{ direction }}
      to="/courses/$courseId/books/$bookId/learn"
      variant={variant}
    >
      {children}
    </ActionLink>
  ) : (
    <ActionLink
      className={className}
      onClick={onClick}
      params={{ courseId, unitId: selection.unitId }}
      search={{ direction }}
      to="/courses/$courseId/units/$unitId/learn"
      variant={variant}
    >
      {children}
    </ActionLink>
  );
