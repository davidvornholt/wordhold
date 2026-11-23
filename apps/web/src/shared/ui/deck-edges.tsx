// The edges of the cards waiting behind the top one, the farthest first so
// the nearer one is drawn over it. Each peeks out further below the card and
// narrower, like a stack of index cards seen from above. At most two show.
// Rendered first inside the relative box that holds the top card.
const edges = ['inset-x-6 -bottom-3', 'inset-x-3 -bottom-1.5'];

export const DeckEdges = ({ count }: { readonly count: number }) =>
  edges
    .slice(Math.max(edges.length - count, 0))
    .map((edge) => (
      <div
        aria-hidden="true"
        className={`absolute top-0 border border-border bg-card ${edge}`}
        key={edge}
      />
    ));
