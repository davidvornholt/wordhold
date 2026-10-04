import { ActionLink } from '../../../shared/ui/action-link';

// The search parameters that name the selected words: their whole book or
// unit, or the entries themselves.
type SelectionSearch =
  | { readonly entries: string }
  | { readonly book: string | undefined; readonly unit: string | undefined };

type SelectionActionsProps = {
  readonly courseId: string;
  readonly intent: 'learn' | 'practice';
  readonly search: SelectionSearch;
  // Only a language course's words have example sentences to translate.
  readonly sentences: boolean;
};

// Words already met can also be practised in their example sentences. Until
// one of them is met, a round would have nothing to translate.
export const SelectionActions = ({
  courseId,
  intent,
  search,
  sentences,
}: SelectionActionsProps) => (
  <>
    {sentences && intent === 'practice' ? (
      <ActionLink
        params={{ courseId }}
        search={search}
        to="/courses/$courseId/sentences"
        variant="outline"
      >
        Sätze übersetzen
      </ActionLink>
    ) : null}
    <ActionLink
      params={{ courseId }}
      search={{ ...search, mode: intent }}
      to="/courses/$courseId/study"
    >
      Auswahl {intent === 'learn' ? 'kennenlernen' : 'üben'}
    </ActionLink>
  </>
);
