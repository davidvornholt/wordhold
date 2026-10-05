import { expect, it } from 'bun:test';
import { workloads } from './workloads';

// Providers may answer an absent optional field with null, as the canonical
// JSON schema they are shown allows. A correct page answered that way passes.
it('scores a correct extraction with null optional fields as passing', async () => {
  const extraction = (await workloads()).find(
    ({ name }) => name === 'extraction',
  );
  const entries = [
    ['el/la abogado/-a', 'der Anwalt / die Anwältin'],
    ['obtener algo (como tener)', 'etwas bekommen'],
    ['determinado/-a', 'bestimmt'],
    ['el programa m.', 'das Programm'],
    ['la dirección', 'die Adresse'],
    ['preguntar', 'fragen'],
  ].map(([targetText, nativeText]) => ({
    targetText,
    nativeText,
    grammar: null,
    example: null,
    exampleTranslation: null,
    confidence: 0.9,
  }));
  expect(
    extraction?.qualityFailures({
      unitName: null,
      pageNumber: 42,
      pageNumberConfidence: null,
      entries,
      overallConfidence: 0.9,
    }),
  ).toEqual([]);
});
