import { expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { VocabularyEntry } from '../../../features/courses/schemas/course-units';
import type { VocabularyFilter } from '../../../features/courses/schemas/vocabulary-search';
import { parseSubjectSearch } from '../../../features/courses/schemas/vocabulary-search';
import { PlaceVocabulary } from '../../../features/courses/ui/place-vocabulary';
import { withoutPitfalls } from '../../../shared/pitfalls/pitfall-model';
import type { PlaceSelectionData } from '../../../shared/session/vocabulary-selection';
import { PlaceBackLink, PlacePageLink } from './-course-place';

const entry: VocabularyEntry = {
  id: '00000000-0000-0000-0000-000000000003',
  bookId: '00000000-0000-0000-0000-000000000001',
  bookName: 'Book',
  unitId: null,
  unitName: null,
  targetText: 'memory',
  nativeText: 'Erinnerung',
  keyPoints: null,
  synonyms: null,
  antonyms: null,
  spellingPitfalls: null,
  example: null,
  introduced: true,
  cards: [],
};

const filters: ReadonlyArray<VocabularyFilter> = [
  'due',
  'first-reviews',
  'difficult',
];
const selections: ReadonlyArray<PlaceSelectionData> = [
  { bookId: '00000000-0000-0000-0000-000000000001' },
  { unitId: '00000000-0000-0000-0000-000000000002' },
];

it.each(
  filters.flatMap((filter) =>
    selections.map((selection) => ({ filter, selection })),
  ),
)(
  'returns to the selected place with its original filter: %j',
  ({ filter, selection }) => {
    const props = { courseId: 'course', filter, selection, children: 'Return' };
    for (const link of [
      PlaceBackLink(props),
      PlacePageLink({ ...props, variant: 'quiet-muted' }),
    ]) {
      expect(link.props.search).toEqual({ filter });
      const returned = parseSubjectSearch(link.props.search);
      const markup = renderToStaticMarkup(
        <PlaceVocabulary
          enabledDirections={['to_target']}
          entries={[entry]}
          entryActions={{
            renderDetail: () => null,
            renderEditor: () => null,
            remove: () => Promise.resolve(),
            skipLearning: () => Promise.resolve([]),
            returnToLearning: () => Promise.resolve([]),
            preparePitfalls: withoutPitfalls,
          }}
          entryForm={null}
          importAction={null}
          initialFilter={returned.filter ?? 'all'}
          place={'bookId' in selection ? 'book' : 'unit'}
          renderStudyAction={() => null}
          subject={{ kind: 'language', targetLanguage: 'en' }}
        />,
      );
      expect(markup).toContain(`<option value="${filter}" selected="">`);
      expect(link.props.params).toEqual({ courseId: 'course', ...selection });
      expect(link.props.to).toBe(
        'bookId' in selection
          ? '/courses/$courseId/books/$bookId'
          : '/courses/$courseId/units/$unitId',
      );
    }
  },
);
