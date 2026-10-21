import type { NotesReading } from '../src/features/import/services/repository';
import { TermVerificationWorkbench } from '../src/features/import/ui/term-verification-workbench';
import { fixtureBackControl } from './fixture-controls';
import { navigateToFixture, saveSubmittedTerms } from './fixture-state';
import { subjectName } from './subject-fixture-data';

const alkanes = [
  ['Methan', 'CH₄'],
  ['Ethan', 'C₂H₆'],
  ['Propan', 'C₃H₈'],
  ['Butan', 'C₄H₁₀'],
  ['Pentan', 'C₅H₁₂'],
  ['Hexan', 'C₆H₁₄'],
  ['Heptan', 'C₇H₁₆'],
  ['Octan', 'C₈H₁₈'],
] as const;

const notesMarkup = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 840">
    <title>Handwritten chemistry notes on alkanes</title>
    <rect width="600" height="840" fill="#fbfaf4"/>
    <g stroke="#b9cde0" stroke-width="1">
      ${Array.from({ length: 24 }, (_, line) => `<line x1="0" y1="${120 + line * 30}" x2="600" y2="${120 + line * 30}"/>`).join('')}
    </g>
    <g font-family="cursive" fill="#1d2b4f">
      <text x="48" y="80" font-size="34">Alkane</text>
      <text x="48" y="146" font-size="20">Alkan: organische Verbindung mit</text>
      <text x="48" y="176" font-size="20">der Summenformel CₙH₂ₙ₊₂</text>
      <text x="48" y="236" font-size="20">Homologe Reihe: Glieder unterscheiden</text>
      <text x="48" y="266" font-size="20">sich um CH₂</text>
      ${alkanes.map(([name, formula], index) => `<text x="72" y="${326 + index * 30}" font-size="20">${name}</text><text x="300" y="${326 + index * 30}" font-size="20">${formula}</text>`).join('')}
    </g>
  </svg>
`;

const photographedNotes = `data:image/svg+xml,${encodeURIComponent(notesMarkup)}`;

const reading: NotesReading = {
  modelId: 'fixture-model',
  notes: {
    textTop: 'up',
    terms: [
      {
        term: 'Alkan',
        definition:
          'Organische Verbindung mit der Summenformel CₙH₂ₙ₊₂; n = 1, 2, 3, …',
        confidence: 0.95,
      },
      {
        term: 'Homologe Reihe',
        definition:
          'Reihe von organischen Molekülen, deren aufeinanderfolgende Glieder sich um ein Kohlenstoffatom und zwei Wasserstoffatome unterscheiden (kurz: CH₂)',
        confidence: 0.9,
      },
      ...alkanes.map(([term, definition]) => ({
        term,
        definition,
        confidence: 0.95,
      })),
      { term: 'Trindecan', definition: 'C₁₃H₂₈', confidence: 0.55 },
    ],
  },
};

// The subject already has Methan, so the reading's Methan is skipped.
const existingTerms = ['Methan', 'Wasserstoff'];

// An empty reading, as from a blurred photo, offers to read it again.
const emptyReading: NotesReading = {
  modelId: 'fixture-model',
  notes: { textTop: 'up', terms: [] },
};

export const TermReviewFixture = ({ empty }: { readonly empty: boolean }) => (
  <main className="verification-screen">
    <div className="verification-header">
      {fixtureBackControl('Seitenstapel', 'import-session')}
      <h1 className="font-display font-semibold text-2xl">
        {subjectName}: Notizen überprüfen
      </h1>
    </div>
    <TermVerificationWorkbench
      batchIsLastPage={false}
      batchSession={null}
      busy={false}
      courseId="00000000-0000-0000-0000-000000000006"
      existingTerms={existingTerms}
      onRetryReading={() => undefined}
      onSubmit={(terms) => {
        saveSubmittedTerms(terms);
        navigateToFixture('terms-course');
      }}
      pageImageSource={photographedNotes}
      reading={empty ? emptyReading : reading}
      readingRevision={0}
      retrying={false}
      verified={false}
    />
  </main>
);
