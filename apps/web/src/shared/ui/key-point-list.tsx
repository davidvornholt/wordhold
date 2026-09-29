// What a definition must state, one short statement per point. Once an answer
// has been judged, each point shows whether it was there.
export type KeyPointItem = {
  readonly text: string;
  readonly covered: boolean | null;
  readonly note: string | null;
};

const mark = (covered: boolean | null) => {
  if (covered === null) {
    return { symbol: '·', label: null, className: 'text-muted-foreground' };
  }
  return covered
    ? { symbol: '✓', label: 'Genannt', className: 'text-primary' }
    : { symbol: '✗', label: 'Fehlt', className: 'text-destructive' };
};

export const KeyPointList = ({
  items,
}: {
  readonly items: ReadonlyArray<KeyPointItem>;
}) => (
  <div className="flex flex-col gap-1.5">
    <p className="text-muted-foreground text-sm">Darauf kommt es an</p>
    <ul className="flex flex-col gap-1.5 text-sm">
      {items.map((item) => {
        const { symbol, label, className } = mark(item.covered);
        return (
          <li className="flex gap-2" key={item.text}>
            <span aria-hidden="true" className={`w-4 shrink-0 ${className}`}>
              {symbol}
            </span>
            <span>
              {label === null ? null : (
                <span className="sr-only">{label}: </span>
              )}
              {item.text}
              {item.note === null ? null : (
                <span className="block text-muted-foreground">{item.note}</span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  </div>
);
