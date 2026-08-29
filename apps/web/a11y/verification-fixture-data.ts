import type { DraftEntry } from '../src/features/import/ui/entry-row';

export const verificationEntries: ReadonlyArray<DraftEntry> = [
  {
    targetText: 'journey',
    nativeText: 'Reise',
    example: 'The journey takes three hours.',
    grammar: { _tag: 'noun', plural: 'journeys' },
    confidence: 0.98,
  },
  {
    targetText: 'luggage',
    nativeText: 'Gepäck',
    example: 'Leave your luggage at reception.',
    grammar: { _tag: 'noun' },
    confidence: 0.96,
  },
  {
    targetText: 'to set off',
    nativeText: 'aufbrechen',
    example: 'We set off before sunrise.',
    grammar: { _tag: 'verb', irregularForms: ['set off', 'set off'] },
    confidence: 0.91,
  },
  {
    targetText: 'accommodation',
    nativeText: 'Unterkunft',
    example: '',
    grammar: { _tag: 'noun' },
    confidence: 0.64,
  },
  {
    targetText: 'booked up',
    nativeText: 'ausgebucht',
    example: 'The guest house is booked up.',
    confidence: 0.87,
  },
  {
    targetText: 'sightseeing',
    nativeText: 'Besichtigung',
    example: 'We went sightseeing in York.',
    confidence: 0.93,
  },
  {
    targetText: 'to miss the train',
    nativeText: 'den Zug verpassen',
    example: 'Hurry up or we will miss the train.',
    confidence: 0.89,
  },
  {
    targetText: 'How long are you staying?',
    nativeText: 'Wie lange bleibst du?',
    example: '',
    confidence: 0.97,
  },
  {
    targetText: 'scenic',
    nativeText: 'malerisch',
    example: 'We took the scenic route along the coast.',
    grammar: {
      _tag: 'adjective',
      comparative: 'more scenic',
      superlative: 'most scenic',
    },
    confidence: 0.85,
  },
  {
    targetText: 'youth hostel',
    nativeText: 'Jugendherberge',
    example: 'The youth hostel has a shared kitchen.',
    grammar: { _tag: 'noun', plural: 'youth hostels' },
    confidence: 0.94,
  },
  {
    targetText: 'abroad',
    nativeText: 'im Ausland',
    example: 'She is studying abroad this year.',
    grammar: { _tag: 'other', note: 'adverb' },
    confidence: 0.9,
  },
  {
    targetText: 'souvenir',
    nativeText: 'Andenken',
    example: 'I bought a small souvenir at the museum.',
    grammar: { _tag: 'noun', plural: 'souvenirs' },
    confidence: 0.92,
  },
];

const photographedPageMarkup = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 840">
    <title>Unit 3 Holidays vocabulary page</title>
    <rect x="24" y="24" width="552" height="792" fill="none" stroke="currentColor" stroke-width="2"/>
    <text x="52" y="76" font-family="serif" font-size="30">Unit 3 · Holidays</text>
    <text x="52" y="108" font-family="sans-serif" font-size="15">Words and phrases</text>
    <line x1="52" y1="126" x2="548" y2="126" stroke="currentColor"/>
    <g font-family="sans-serif" font-size="17">
      <text x="52" y="166">journey</text><text x="330" y="166">Reise</text>
      <text x="52" y="208">luggage</text><text x="330" y="208">Gepäck</text>
      <text x="52" y="250">to set off</text><text x="330" y="250">aufbrechen</text>
      <text x="52" y="292">accommodation</text><text x="330" y="292">Unterkunft</text>
      <text x="52" y="334">booked up</text><text x="330" y="334">ausgebucht</text>
      <text x="52" y="376">sightseeing</text><text x="330" y="376">Besichtigung</text>
      <text x="52" y="418">to miss the train</text><text x="330" y="418">den Zug verpassen</text>
      <text x="52" y="460">How long are you staying?</text><text x="330" y="460">Wie lange bleibst du?</text>
      <text x="52" y="502">scenic</text><text x="330" y="502">malerisch</text>
      <text x="52" y="544">youth hostel</text><text x="330" y="544">Jugendherberge</text>
      <text x="52" y="586">abroad</text><text x="330" y="586">im Ausland</text>
      <text x="52" y="628">souvenir</text><text x="330" y="628">Andenken</text>
    </g>
    <line x1="52" y1="662" x2="548" y2="662" stroke="currentColor"/>
    <text x="52" y="700" font-family="serif" font-size="20">Travel note</text>
    <text x="52" y="732" font-family="sans-serif" font-size="15">We set off before sunrise and took the scenic route.</text>
    <text x="52" y="760" font-family="sans-serif" font-size="15">The youth hostel kept our luggage until check-in.</text>
  </svg>
`;

export const photographedPage = `data:image/svg+xml,${encodeURIComponent(
  photographedPageMarkup,
)}`;
