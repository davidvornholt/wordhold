import type { ReactNode } from 'react';
import {
  type CourseUnit,
  introducedEntries,
  unitOffers,
} from '../schemas/course-units';
import { unitPracticeStatus } from './unit-status';

type UnitDetailProps = {
  readonly unit: CourseUnit;
  readonly learnAction: ReactNode;
  readonly practiceAction: ReactNode;
  readonly vocabularyAction: ReactNode;
};

const unitSummary = (unit: CourseUnit): string => {
  if (unit.entries === 0) {
    return 'Noch keine Vokabeln';
  }
  if (unit.unintroduced === 0) {
    return `${unit.entries} Vokabeln · alle aktiven Richtungen kennengelernt`;
  }
  if (unit.introduced === 0) {
    return `${unit.entries} Vokabeln · noch nicht kennengelernt`;
  }
  return `${unit.entries} Vokabeln · ${introducedEntries(unit)} frei übbar · ${unit.unintroduced} mit offenen Lernschritten`;
};

export const UnitDetail = ({
  unit,
  learnAction,
  practiceAction,
  vocabularyAction,
}: UnitDetailProps) => {
  const offers = unitOffers(unit);
  return (
    <>
      <p className="text-muted-foreground text-sm">{unitSummary(unit)}</p>
      <p className="text-sm">{unitPracticeStatus(unit)}</p>
      <div className="flex flex-wrap gap-4">
        {offers.learn ? learnAction : null}
        {offers.practice ? practiceAction : null}
        {unit.entries > 0 ? vocabularyAction : null}
      </div>
    </>
  );
};
