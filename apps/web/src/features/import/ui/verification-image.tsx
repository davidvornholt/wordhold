type VerificationImageProps = {
  readonly src: string;
  readonly alt: string;
};

export const VerificationImage = ({ src, alt }: VerificationImageProps) => (
  <img
    alt={alt}
    className="h-auto w-full self-start border border-border xl:max-h-[calc(100dvh-3rem)] xl:w-auto xl:max-w-full"
    src={src}
  />
);
