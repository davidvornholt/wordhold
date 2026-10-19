import { CopyIcon, PenLineIcon, TriangleAlertIcon } from 'lucide-react';
import { useId } from 'react';
import { isUncertain } from './draft-rows';
import { indexesWhere } from './flag-indexes';
import { FlagJump } from './review-checklist';
import type { TermReviewForm } from './use-term-review';

// What still needs a look before the terms are saved, each with a way to
// get to it. Nothing is listed for notes that were read cleanly.
export const TermReviewChecklist = ({
  form,
}: {
  readonly form: TermReviewForm;
}) => {
  const headingId = useId();
  const { rows, review, formRef } = form;
  const uncertain = indexesWhere(rows, isUncertain);
  const repeats = indexesWhere(
    review.repeats,
    (repeat) => repeat.verdict !== 'none',
  );
  const { incomplete } = review;
  if (uncertain.length + repeats.length + incomplete.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 className="eyebrow" id={headingId}>
        Vor dem Eintragen
      </h2>
      <ul className="flex flex-wrap gap-2">
        {uncertain.length === 0 ? null : (
          <li>
            <FlagJump
              field={() => 'target'}
              flagged={uncertain}
              formRef={formRef}
              icon={TriangleAlertIcon}
              label={`${uncertain.length} unsicher gelesen`}
              rows={rows}
            />
          </li>
        )}
        {repeats.length === 0 ? null : (
          <li>
            <FlagJump
              field={() => 'target'}
              flagged={repeats}
              formRef={formRef}
              icon={CopyIcon}
              label={`${repeats.length} schon vorhanden`}
              rows={rows}
            />
          </li>
        )}
        {incomplete.length === 0 ? null : (
          <li>
            <FlagJump
              field={(index) =>
                rows[index]?.term.trim() === '' ? 'target' : 'native'
              }
              flagged={incomplete}
              formRef={formRef}
              icon={PenLineIcon}
              label={`${incomplete.length} unvollständig`}
              rows={rows}
            />
          </li>
        )}
      </ul>
    </section>
  );
};
