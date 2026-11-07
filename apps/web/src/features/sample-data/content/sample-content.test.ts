import { describe, expect, it } from 'bun:test';
import { KeyPoints } from '@wordhold/ai/definition/schema';
import { maximumEntryTextLength } from '@wordhold/ai/extraction/schema';
import { Schema } from 'effect';
import { settledColumns } from '../../../shared/ai/usage-ledger';
import type { SampleCourse, SampleWord } from './sample-models';
import { samplePeople } from './sample-people';

const courses = samplePeople.flatMap((person) => person.courses);

const wordsOf = (course: SampleCourse): ReadonlyArray<SampleWord> =>
  course.kind === 'language'
    ? course.books.flatMap((book) => [
        ...book.units.flatMap((unit) => unit.words),
        ...book.words,
      ])
    : [];

const words = courses.flatMap(wordsOf);
const terms = courses.flatMap((course) =>
  course.kind === 'terms' ? course.terms : [],
);
const texts = courses.flatMap((course) =>
  course.kind === 'texts' ? course.texts : [],
);
const sentenceEnd = /[.!?]$/u;

describe('sample content', () => {
  it('uses addresses that cannot reach anyone', () => {
    for (const person of samplePeople) {
      expect(person.email).toEndWith('.invalid');
    }
  });

  it('has exactly one administrator', () => {
    expect(
      samplePeople.filter((person) => person.standing === 'administrator'),
    ).toHaveLength(1);
  });

  it('lists each word once per course', () => {
    for (const course of courses) {
      const targets = wordsOf(course).map((word) => word.target);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });

  it('marks pitfalls the way the pitfall writer would', () => {
    const pitfalls = words.flatMap((word) =>
      word.pitfall === undefined ? [] : [{ word, ...word.pitfall }],
    );
    expect(pitfalls.length).toBeGreaterThan(0);
    expect(
      pitfalls.filter(
        (pitfall) =>
          !(
            pitfall.word.target.includes(pitfall.tricky) &&
            sentenceEnd.test(pitfall.note)
          ) || pitfall.note.length > 160,
      ),
    ).toEqual([]);
  });

  it('keeps related words apart from the word itself', () => {
    for (const word of words) {
      const related = [
        ...(word.related?.synonyms ?? []),
        ...(word.related?.antonyms ?? []),
      ];
      expect(related).not.toContain(word.target);
    }
  });

  it('gives terms key points the app accepts and texts it can store', () => {
    expect(terms.length).toBeGreaterThan(0);
    expect(
      terms.filter(
        (term) =>
          !Schema.is(KeyPoints)(term.keyPoints) ||
          term.definition.length > maximumEntryTextLength,
      ),
    ).toEqual([]);
    expect(texts.length).toBeGreaterThan(0);
    expect(
      texts.filter((text) => text.text.length > maximumEntryTextLength),
    ).toEqual([]);
  });

  it('prices every successful AI request and no failed one', () => {
    const requests = samplePeople.flatMap((person) => person.usage);
    expect(
      requests.filter(
        (request) =>
          (settledColumns(request.call, request.usage).estimatedUsd ===
            null) !==
          (request.usage === undefined),
      ),
    ).toEqual([]);
  });
});
