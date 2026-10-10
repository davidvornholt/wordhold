import { describe, expect, it } from 'bun:test';
import { Schema } from 'effect';
import { CourseDirections } from './course-directions';

const decode = Schema.decodeUnknownExit(CourseDirections);

describe('CourseDirections', () => {
  it('accepts translations with or without synonyms and antonyms', () => {
    expect(decode(['to_native'])._tag).toBe('Success');
    expect(
      decode(['to_target', 'to_native', 'to_synonym', 'to_antonym'])._tag,
    ).toBe('Success');
  });

  it('keeps a translation direction on', () => {
    expect(String(decode(['to_synonym', 'to_antonym']))).toContain(
      'Eine Übersetzungsrichtung bleibt immer an.',
    );
  });

  it('switches synonyms and antonyms only together', () => {
    expect(String(decode(['to_target', 'to_synonym']))).toContain(
      'Synonyme und Gegenteile werden nur zusammen ein- oder ausgeschaltet.',
    );
  });

  it('rejects a direction listed twice', () => {
    expect(String(decode(['to_target', 'to_target']))).toContain(
      'Jede Richtung darf nur einmal vorkommen.',
    );
  });
});
