import type { StudyAction } from '../../../features/courses/ui/study-action';
import { ActionLink } from '../../../shared/ui/action-link';
import type { StudyRouteSearch } from './-study-link';

type SelectionActionsProps = {
  readonly courseId: string;
  readonly action: StudyAction;
  // The selected words and where they were picked: their book's or unit's
  // page, or the list with its filter and place.
  readonly search: Omit<StudyRouteSearch, 'direction' | 'mode' | 'from'>;
  // Only a language course's words have example sentences to translate.
  readonly sentences: boolean;
};

// Words already met can also be practised in their example sentences. Until
// one of them is met, a round would have nothing to translate.
export const SelectionActions = ({
  courseId,
  action,
  search,
  sentences,
}: SelectionActionsProps) => (
  <>
    <ActionLink
      params={{ courseId }}
      search={{ ...search, mode: action.intent }}
      to="/courses/$courseId/study"
      variant={action.primary ? 'primary' : 'outline'}
    >
      Auswahl {action.intent === 'learn' ? 'kennenlernen' : 'üben'}
    </ActionLink>
    {sentences && action.intent === 'practice' ? (
      <ActionLink
        params={{ courseId }}
        search={search}
        to="/courses/$courseId/sentences"
        variant="outline"
      >
        Sätze übersetzen
      </ActionLink>
    ) : null}
  </>
);
