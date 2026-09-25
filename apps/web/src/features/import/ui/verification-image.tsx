type VerificationImageProps = {
  readonly src: string;
};

export const VerificationImage = ({ src }: VerificationImageProps) => (
  <img
    alt="Fotografierte Vokabelseite"
    className="h-auto w-full self-start border border-border xl:max-h-[calc(100dvh-3rem)] xl:w-auto xl:max-w-full"
    src={src}
  />
);
