import type { ReactNode } from 'react';
import { countNoun } from '../../../shared/format/count';
import { cardClass } from '../../../shared/ui/surface-styles';

type UnlearnedNoticeProps = {
  // Cards of the selection neither learned nor skipped yet.
  readonly unlearned: number;
  // Whether some of the selection can be practised already.
  readonly practisable: boolean;
  // Leads to learning the selection.
  readonly learnAction: ReactNode;
};

// Practice asks only what has been learned or skipped, so a selection with
// cards still open says how many practice leaves out and offers learning
// them.
export const UnlearnedNotice = ({
  unlearned,
  practisable,
  learnAction,
}: UnlearnedNoticeProps) => (
  <div className={`flex flex-col items-start gap-3 ${cardClass} text-sm`}>
    <p>
      {practisable
        ? `${countNoun(unlearned, 'Karte', 'Karten')} dieser Auswahl hast du noch nicht kennengelernt.`
        : 'Von dieser Auswahl hast du noch nichts kennengelernt.'}{' '}
      Abgefragt wird nur, was du schon kennengelernt oder übersprungen hast.
    </p>
    {learnAction}
  </div>
);
