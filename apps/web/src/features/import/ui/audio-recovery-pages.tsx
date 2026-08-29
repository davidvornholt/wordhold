import type { ReactNode } from 'react';

type AudioRecoveryPage = {
  readonly id: string;
  readonly courseName: string;
  readonly missingAudio: number;
  readonly verifiedAt: Date;
};

type AudioRecoveryPagesProps = {
  readonly pages: ReadonlyArray<AudioRecoveryPage>;
  readonly renderPageAction: (
    page: AudioRecoveryPage,
    label: string,
  ) => ReactNode;
};

const pageTitle = (page: AudioRecoveryPage) => {
  const date = new Date(page.verifiedAt).toLocaleDateString('de-DE');
  return `${page.courseName} (${date})`;
};

export const AudioRecoveryPages = ({
  pages,
  renderPageAction,
}: AudioRecoveryPagesProps) => {
  if (pages.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl">Fehlendes Audio</h2>
        <p className="text-muted-foreground text-sm">
          Bei diesen importierten Seiten fehlen Audiodateien.
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {pages.map((page) => {
          const title = pageTitle(page);
          return (
            <li className="flex flex-wrap items-baseline gap-2" key={page.id}>
              <span className="text-sm">
                {title}: {page.missingAudio}{' '}
                {page.missingAudio === 1
                  ? 'Audiodatei fehlt.'
                  : 'Audiodateien fehlen.'}
              </span>
              {renderPageAction(page, `Audio für ${title} ergänzen`)}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
