import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import {
  type CourseUnit,
  introducedEntries,
  unitOffers,
  type VocabularyEntry,
} from '../schemas/course-units';
import { EntryList } from './entry-list';
import { unitPracticeStatus } from './unit-status';

type UnitDetailProps = {
  readonly unit: CourseUnit;
  readonly entries: ReadonlyArray<VocabularyEntry>;
  readonly targetLanguage: LanguageCode;
  readonly learnAction: ReactNode;
  readonly practiceAction: ReactNode;
};

const unitSummary = (unit: CourseUnit): string => {
  if (unit.entries === 0) {
    return 'Noch keine Vokabeln';
  }
  return unit.unintroduced === 0
    ? `${unit.entries} Vokabeln · alle kennengelernt`
    : `${unit.entries} Vokabeln · ${introducedEntries(unit)} kennengelernt · ${unit.unintroduced} noch kennenlernen`;
};

export const UnitDetail = ({
  unit,
  entries,
  targetLanguage,
  learnAction,
  practiceAction,
}: UnitDetailProps) => {
  const offers = unitOffers(unit);
  return (
    <>
      <p className="text-muted-foreground text-sm">{unitSummary(unit)}</p>
      <p className="text-sm">{unitPracticeStatus(unit)}</p>
      <div className="flex flex-wrap gap-4">
        {offers.learn ? learnAction : null}
        {offers.practice ? practiceAction : null}
      </div>
      <EntryList targetLanguage={targetLanguage} entries={entries} />
    </>
  );
};
