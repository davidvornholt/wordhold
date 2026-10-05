import { countNoun } from '../../../shared/format/count';
import {
  allowedMistakes,
  type Recitation,
  type RecitationSegment,
  recitationSegments,
} from '../../../shared/grading/recitation';

const mistakeCount = (count: number) => countNoun(count, 'Fehler', 'Fehler');
const typoCount = (count: number) =>
  countNoun(count, 'Tippfehler', 'Tippfehler');
const soundAlikeCount = (count: number) =>
  countNoun(count, 'gleich klingendes Wort', 'gleich klingende Wörter');

// "1 Fehler, 2 Tippfehler und 1 gleich klingendes Wort"
const listed = (items: ReadonlyArray<string>): string =>
  items.length < 2
    ? items.join('')
    : `${items.slice(0, -1).join(', ')} und ${items.at(-1)}`;

const forgivenCounts = ({ typos, soundAlikes }: Recitation) => [
  ...(typos === 0 ? [] : [typoCount(typos)]),
  ...(soundAlikes === 0 ? [] : [soundAlikeCount(soundAlikes)]),
];

const forgivenNote = ({ typos, soundAlikes }: Recitation): string => {
  if (soundAlikes === 0) {
    return 'Tippfehler zählen nicht als Fehler.';
  }
  return typos === 0
    ? 'Gleich klingende Wörter zählen nicht als Fehler.'
    : 'Tippfehler und gleich klingende Wörter zählen nicht als Fehler.';
};

// How many words were wrong, and how many mistakes were allowed.
const recitationSummary = (recitation: Recitation): string => {
  const { words, mistakes } = recitation;
  const wordCount = countNoun(words, 'Wort', 'Wörtern');
  const forgiven = forgivenCounts(recitation);
  if (mistakes === 0) {
    return forgiven.length === 0
      ? 'Kein Fehler.'
      : `${listed(forgiven)} bei ${wordCount}. ${forgivenNote(recitation)}`;
  }
  const allowed = allowedMistakes(words);
  return `${listed([mistakeCount(mistakes), ...forgiven])} bei ${wordCount}. Erlaubt ${allowed === 1 ? 'ist' : 'sind'} ${mistakeCount(allowed)}.`;
};

const removedClass = 'text-muted-foreground line-through';
const restoredClass =
  'rounded-sm bg-destructive/10 px-0.5 font-medium text-destructive no-underline';

// Every mark says in words what it means, since its color and line cannot
// be heard or told apart by everyone.
const Segment = ({ segment }: { readonly segment: RecitationSegment }) => {
  switch (segment.kind) {
    case 'text':
    case 'same':
      return segment.text;
    case 'missing':
      return (
        <ins className={restoredClass}>
          <span className="sr-only">Fehlt: </span>
          {segment.text}
        </ins>
      );
    case 'wrong':
      return (
        <>
          <del className={removedClass}>
            <span className="sr-only">Geschrieben: </span>
            {segment.typed}
          </del>{' '}
          <ins className={restoredClass}>
            <span className="sr-only">Richtig: </span>
            {segment.text}
          </ins>
        </>
      );
    case 'extra':
      return (
        <del className={removedClass}>
          <span className="sr-only">Zu viel: </span>
          {segment.typed}
        </del>
      );
    case 'typo':
      return (
        <span className="underline decoration-warning-foreground decoration-wavy underline-offset-4">
          {segment.text}
          <span className="sr-only"> (vertippt als {segment.typed})</span>
        </span>
      );
    case 'soundAlike':
      return (
        <span className="underline decoration-muted-foreground decoration-dotted underline-offset-4">
          {segment.text}
          <span className="sr-only"> (gehört als {segment.typed})</span>
        </span>
      );
    default:
      return segment satisfies never;
  }
};

// The text as written in the collection, with what the recitation got wrong
// marked in place: a wrong word struck through before the right one, a
// missing word highlighted, an extra word struck through, a typo underlined
// with a wavy line, and a word that sounds right with a dotted one.
export const RecitationFeedback = ({
  original,
  recitation,
}: {
  readonly original: string;
  readonly recitation: Recitation;
}) => {
  const segments = recitationSegments(original, recitation);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{recitationSummary(recitation)}</p>
      <p className="wrap-break-word hyphens-auto whitespace-pre-line text-lg leading-relaxed">
        {segments.map((segment, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: The segments come from the same two texts on every render and never reorder.
          <Segment key={index} segment={segment} />
        ))}
      </p>
    </div>
  );
};
