import type { LanguageCode } from '@wordhold/db/schema/courses';
import {
  type RelatedWordListsData,
  relationKinds,
  relationLabels,
} from '../../../shared/vocabulary/related-words';

type RelatedWordsSummaryProps = {
  readonly lists: RelatedWordListsData;
  readonly targetLanguage: LanguageCode;
};

// A word's synonyms and antonyms in its details. A list that is empty or not
// settled yet is left out.
export const RelatedWordsSummary = ({
  lists,
  targetLanguage,
}: RelatedWordsSummaryProps) => {
  const filled = relationKinds.flatMap((kind) => {
    const words = lists[kind];
    return words === null || words.length === 0 ? [] : [{ kind, words }];
  });
  if (filled.length === 0) {
    return null;
  }
  return (
    <dl className="grid gap-3">
      {filled.map(({ kind, words }) => (
        <div className="grid gap-0.5" key={kind}>
          <dt className="font-medium">{relationLabels[kind]}</dt>
          <dd className="hyphens-auto" lang={targetLanguage}>
            {words.join(', ')}
          </dd>
        </div>
      ))}
    </dl>
  );
};
