export const DeferredExampleControls = ({
  onHide,
  onResolve,
}: {
  readonly onHide: () => void;
  readonly onResolve: () => void;
}) => (
  <div>
    <button onClick={onHide} type="button">
      Sitzung ausblenden
    </button>
    <button onClick={onResolve} type="button">
      Beispielsatz freigeben
    </button>
  </div>
);
