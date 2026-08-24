import { describe, expect, it } from 'bun:test';
import {
  generateAudio,
  maximumAudioProviderCallsPerImport,
} from './audio-generation';

const uuidSuffixWidth = 12;

const entries = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `d9428888-122b-41e1-b85c-${String(index).padStart(uuidSuffixWidth, '0')}`,
    targetText: `Wort ${index}`,
  }));

describe('generateAudio', () => {
  it('never exceeds the provider-call budget for one import', async () => {
    let providerCalls = 0;
    const generated = await generateAudio(
      entries(maximumAudioProviderCallsPerImport + 1),
      'fr',
      {
        synthesize: () => {
          providerCalls += 1;
          return Promise.resolve({
            voice: 'Lea',
            audio: new Uint8Array([1]),
          });
        },
        writeFile: () => Promise.resolve(),
        removeFile: () => Promise.resolve(),
        insertReference: () => Promise.resolve(),
      },
    );
    expect(providerCalls).toBe(maximumAudioProviderCallsPerImport);
    expect(generated).toBe(maximumAudioProviderCallsPerImport);
  });

  it('removes audio after a database-reference failure', async () => {
    const actions: Array<string> = [];
    await generateAudio(entries(1), 'fr', {
      synthesize: () =>
        Promise.resolve({ voice: 'Lea', audio: new Uint8Array([1]) }),
      writeFile: () => {
        actions.push('write');
        return Promise.resolve();
      },
      insertReference: () => {
        actions.push('insert');
        return Promise.reject(new Error('insert failed'));
      },
      removeFile: () => {
        actions.push('remove');
        return Promise.resolve();
      },
    });
    expect(actions).toEqual(['write', 'insert', 'remove']);
  });
});
