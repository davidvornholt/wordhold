type SubmissionNoticeProps = {
  readonly error: string | null;
  readonly reconnecting: boolean;
};

// Below the answer form: why the last answer could not be checked, or that
// it is being sent again while the server cannot be reached.
export const SubmissionNotice = ({
  error,
  reconnecting,
}: SubmissionNoticeProps) => {
  if (error !== null) {
    return (
      <p className="text-destructive text-sm" role="alert">
        {error}
      </p>
    );
  }
  return reconnecting ? (
    <p className="text-muted-foreground text-sm" role="status">
      Verbindung wird wiederhergestellt …
    </p>
  ) : null;
};
