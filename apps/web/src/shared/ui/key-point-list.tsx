import { VerdictMark } from './verdict-mark';

// What a definition must state, one short statement per point. Once an answer
// has been judged, each point shows whether it was there.
export type KeyPointItem = {
  readonly text: string;
  readonly covered: boolean | null;
};

// The marks are drawn one after another once the verdict is in, the way a
// teacher goes down the points. The delays are written out so Tailwind finds
// them; a longer list draws its last points together.
const staggers = [
  '[animation-delay:var(--motion-slow)]',
  '[animation-delay:calc(var(--motion-slow)+var(--motion-fast))]',
  '[animation-delay:calc(var(--motion-slow)+var(--motion-fast)*2)]',
  '[animation-delay:calc(var(--motion-slow)+var(--motion-fast)*3)]',
  '[animation-delay:calc(var(--motion-slow)+var(--motion-fast)*4)]',
] as const;

const KeyPointMark = ({
  covered,
  index,
}: {
  readonly covered: boolean | null;
  readonly index: number;
}) => {
  if (covered === null) {
    return (
      <span aria-hidden="true" className="w-4 shrink-0 text-muted-foreground">
        ·
      </span>
    );
  }
  return (
    <span className="flex h-5 shrink-0 items-center">
      <VerdictMark
        className="size-4"
        delayClass={staggers[Math.min(index, staggers.length - 1)]}
        kind={covered ? 'check' : 'cross'}
      />
      <span className="sr-only">{covered ? 'Genannt' : 'Fehlt'}: </span>
    </span>
  );
};

// Beside a definition to learn, the points are titled; under a verdict their
// marks already say what they are.
export const KeyPointList = ({
  items,
  titled,
}: {
  readonly items: ReadonlyArray<KeyPointItem>;
  readonly titled: boolean;
}) => (
  <div className="flex flex-col gap-1.5">
    {titled ? (
      <p className="text-muted-foreground text-sm">Darauf kommt es an</p>
    ) : null}
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((item, index) => (
        <li className="flex gap-2" key={item.text}>
          <KeyPointMark covered={item.covered} index={index} />
          <span>{item.text}</span>
        </li>
      ))}
    </ul>
  </div>
);
