type ProgressMeterProps = {
  readonly accessibleName: string;
  readonly description: string;
  readonly total: number;
  readonly value: number;
};

export const ProgressMeter = ({
  accessibleName,
  description,
  total,
  value,
}: ProgressMeterProps) => (
  <div className="flex flex-col gap-1.5">
    <progress
      aria-label={accessibleName}
      className="h-1.5 w-full accent-primary"
      max={total}
      value={value}
    />
    <p className="text-muted-foreground text-sm">{description}</p>
  </div>
);
