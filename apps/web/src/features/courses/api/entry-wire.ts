import type {
  CourseOutline as ApiOutline,
  Entry,
} from '@wordhold/api/vocabulary';
import type { AnswerDirection } from '@wordhold/db/schema/directions';
import type {
  CourseOutline,
  VocabularyEntry,
  WordProgress,
} from '../schemas/course-units';
import type { ApiCourse } from './course-records';

const instant = (date: Date | null) =>
  date === null ? null : date.toISOString();

/**
 * One entry as the CLI's API shows it. Terms and texts keep their entries in
 * a hidden book, so they show neither book nor unit.
 */
export const toApiEntry = (
  course: ApiCourse,
  entry: VocabularyEntry,
): Entry => {
  const placed = course.kind === 'language';
  return {
    id: entry.id,
    course: { id: course.id, name: course.name, kind: course.kind },
    book: placed ? { id: entry.bookId, name: entry.bookName } : null,
    unit:
      placed && entry.unitId !== null && entry.unitName !== null
        ? { id: entry.unitId, name: entry.unitName }
        : null,
    targetText: entry.targetText,
    nativeText: entry.nativeText,
    example: entry.example,
    synonyms: entry.synonyms,
    antonyms: entry.antonyms,
    keyPoints: entry.keyPoints,
    introduced: entry.introduced,
    cards: entry.cards.map((card) => ({
      direction: card.direction,
      state: card.state,
      dueAt: instant(card.dueAt),
      introducedAt: instant(card.introducedAt),
      failures: card.failures,
      hardAnswers: card.hardAnswers,
    })),
  };
};

const placeNumbers = (progress: WordProgress) => ({
  entries: progress.entries,
  introduced: progress.introduced,
  unintroduced: progress.unintroduced,
  due: progress.due,
  firstReviews: progress.firstReviews,
  nextDueAt: instant(progress.nextDueAt),
});

export const toApiOutline = (
  course: ApiCourse,
  directions: ReadonlyArray<AnswerDirection>,
  { books, units }: CourseOutline,
): ApiOutline => ({
  ...course,
  directions,
  books:
    course.kind === 'language'
      ? books.map((book) => ({
          id: book.id,
          name: book.name,
          ...placeNumbers(book),
          units: units
            .filter((unit) => unit.bookId === book.id)
            .map((unit) => ({
              id: unit.id,
              name: unit.name,
              ...placeNumbers(unit),
            })),
        }))
      : [],
});

// Case and accents are ignored, so "cafe" finds "café".
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('de');

const searchedTexts = (entry: VocabularyEntry) => [
  entry.targetText,
  entry.nativeText,
  ...(entry.synonyms ?? []),
  ...(entry.antonyms ?? []),
  ...(entry.example === null
    ? []
    : [entry.example.targetText, entry.example.nativeText ?? '']),
];

const exact = 0;
const wordStart = 1;
const contained = 2;

const letterOrDigit = /[\p{L}\p{N}]/u;

// Whether the query begins a word of the text, as "cafe" does in "el café".
const startsAWord = (text: string, query: string) => {
  for (
    let index = text.indexOf(query);
    index !== -1;
    index = text.indexOf(query, index + 1)
  ) {
    if (index === 0 || !letterOrDigit.test(text.charAt(index - 1))) {
      return true;
    }
  }
  return false;
};

const matchRank = (text: string, query: string) => {
  const folded = fold(text);
  if (folded === query) {
    return exact;
  }
  if (startsAWord(folded, query)) {
    return wordStart;
  }
  return folded.includes(query) ? contained : undefined;
};

/**
 * The entries that contain the query in a text, an example, a synonym or an
 * antonym: exact matches first, then those where a word starts with it, then
 * the rest, each group in course order.
 */
export const searchEntries = <Item extends { readonly entry: VocabularyEntry }>(
  items: ReadonlyArray<Item>,
  query: string,
  limit: number,
): ReadonlyArray<Item> => {
  const folded = fold(query.trim());
  return items
    .flatMap((item, order) => {
      const ranks = searchedTexts(item.entry)
        .map((text) => matchRank(text, folded))
        .filter((rank) => rank !== undefined);
      return ranks.length === 0
        ? []
        : [{ item, order, rank: Math.min(...ranks) }];
    })
    .sort((left, right) => left.rank - right.rank || left.order - right.order)
    .slice(0, limit)
    .map(({ item }) => item);
};
