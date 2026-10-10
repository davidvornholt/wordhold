import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { RelationDirection } from '@wordhold/db/schema/directions';
import { relationQuestion } from '../practice/card-texts';

type RelationQuestionProps = {
  readonly direction: RelationDirection;
  readonly language: LanguageCode;
};

// "Synonym of" in the course's language, marked so it is read out in it.
export const RelationQuestion = ({
  direction,
  language,
}: RelationQuestionProps) => (
  <span lang={language}>{relationQuestion(direction, language)}</span>
);
