type ProgressMeterProps = {
  readonly accessibleName: string;
  // Omitted where a live status element next to the meter already narrates it.
  readonly description?: string;
  readonly total: number;
  readonly value: number;
};

// The native progress element ignores accent-color in Chromium, so the track
// and fill are styled explicitly to carry the theme.
export const ProgressMeter = ({
  accessibleName,
  description,
  total,
  value,
}: ProgressMeterProps) => (
  <div className="flex flex-col gap-1.5">
    <progress
      aria-label={accessibleName}
      className="h-1.5 w-full appearance-none border-none bg-border [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-border [&::-webkit-progress-value]:bg-primary"
      max={total}
      value={value}
    />
    {description === undefined ? null : (
      <p className="text-muted-foreground text-sm">{description}</p>
    )}
  </div>
);
