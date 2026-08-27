import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import {
  type CourseUnit,
  learnedWords,
  type UnitWord,
  unitOffers,
} from '../schemas/course-units';
import { WordList } from './word-list';

type UnitDetailProps = {
  readonly unit: CourseUnit;
  readonly words: ReadonlyArray<UnitWord>;
  readonly targetLanguage: LanguageCode;
  readonly learnAction: ReactNode;
  readonly drillAction: ReactNode;
};

const unitSummary = (unit: CourseUnit): string => {
  if (unit.words === 0) {
    return 'Noch keine Wörter';
  }
  return unit.unlearned === 0
    ? `${unit.words} Wörter · alle gelernt`
    : `${unit.words} Wörter · ${learnedWords(unit)} gelernt · ${unit.unlearned} noch nicht gelernt`;
};

export const UnitDetail = ({
  unit,
  words,
  targetLanguage,
  learnAction,
  drillAction,
}: UnitDetailProps) => {
  const offers = unitOffers(unit);
  return (
    <>
      <p className="text-muted-foreground text-sm">{unitSummary(unit)}</p>
      <div className="flex flex-wrap gap-4">
        {offers.learn ? learnAction : null}
        {offers.drill ? drillAction : null}
      </div>
      <WordList targetLanguage={targetLanguage} words={words} />
    </>
  );
};
