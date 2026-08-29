import type { LanguageCode } from '@wordhold/db/schema/courses';
import type { ReactNode } from 'react';
import {
  type CourseUnit,
  learnedEntries,
  type UnitEntry,
  unitOffers,
} from '../schemas/course-units';
import { EntryList } from './entry-list';

type UnitDetailProps = {
  readonly unit: CourseUnit;
  readonly entries: ReadonlyArray<UnitEntry>;
  readonly targetLanguage: LanguageCode;
  readonly learnAction: ReactNode;
  readonly drillAction: ReactNode;
};

const unitSummary = (unit: CourseUnit): string => {
  if (unit.entries === 0) {
    return 'Noch keine Vokabeln';
  }
  return unit.unlearned === 0
    ? `${unit.entries} Vokabeln · alle gelernt`
    : `${unit.entries} Vokabeln · ${learnedEntries(unit)} gelernt · ${unit.unlearned} noch nicht gelernt`;
};

export const UnitDetail = ({
  unit,
  entries,
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
      <EntryList targetLanguage={targetLanguage} entries={entries} />
    </>
  );
};
