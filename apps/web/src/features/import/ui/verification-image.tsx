type VerificationImageProps = {
  readonly src: string;
};

export const VerificationImage = ({ src }: VerificationImageProps) => (
  <img
    alt="Fotografierte Vokabelseite"
    className="h-auto w-full self-start rounded-lg border border-neutral-200"
    src={src}
  />
);
