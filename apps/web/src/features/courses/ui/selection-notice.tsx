// What the last move or deletion of a selection did. It sits outside the list,
// so it outlives a list the change emptied. While empty it stays in the
// accessibility tree, so that the first notice is announced.
export const SelectionNotice = ({ notice }: { readonly notice: string }) => (
  <output aria-label="Status der Auswahl" className="text-sm empty:sr-only">
    {notice}
  </output>
);
