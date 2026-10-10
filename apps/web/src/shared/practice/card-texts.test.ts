import { describe, expect, it } from 'bun:test';
import { answerDirections } from '@wordhold/db/schema/directions';
import {
  answerLanguage,
  cardAnswer,
  cardPrompt,
  foreignPromptLanguage,
} from './card-texts';

const word = {
  targetText: 'hostile',
  nativeText: 'feindselig',
  relatedWords: [],
};

describe('card texts', () => {
  it('asks a translation card in one language and answers it in the other', () => {
    expect(cardPrompt({ ...word, direction: 'to_target' })).toBe('feindselig');
    expect(cardAnswer({ ...word, direction: 'to_target' })).toBe('hostile');
    expect(cardPrompt({ ...word, direction: 'to_native' })).toBe('hostile');
    expect(cardAnswer({ ...word, direction: 'to_native' })).toBe('feindselig');
  });

  it('asks a synonym or antonym card with the foreign word and intends its whole list', () => {
    const synonymCard = {
      ...word,
      direction: 'to_synonym' as const,
      relatedWords: ['unfriendly', 'aggressive'],
    };
    expect(cardPrompt(synonymCard)).toBe('hostile');
    expect(cardAnswer(synonymCard)).toBe('unfriendly, aggressive');
    expect(
      cardAnswer({
        ...word,
        direction: 'to_antonym',
        relatedWords: ['friendly'],
      }),
    ).toBe('friendly');
  });

  it('answers in German only when the card asks for the German text', () => {
    expect(
      answerDirections.map((direction) => answerLanguage(direction, 'en')),
    ).toEqual(['en', 'de', 'en', 'en']);
  });

  it('marks every prompt but the German one with the course language', () => {
    expect(
      answerDirections.map((direction) =>
        foreignPromptLanguage(direction, 'en'),
      ),
    ).toEqual([undefined, 'en', 'en', 'en']);
  });
});
