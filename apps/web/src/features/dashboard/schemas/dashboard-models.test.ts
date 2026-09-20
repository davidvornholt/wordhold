import { describe, expect, it } from 'bun:test';
import {
  busiestCourse,
  hasAvailablePractice,
  todayActionLabel,
  totalReady,
} from './dashboard-models';

describe('hasAvailablePractice', () => {
  it('rejects a missing or empty queue', () => {
    expect(hasAvailablePractice(undefined)).toBe(false);
    expect(hasAvailablePractice({ ready: 0 })).toBe(false);
  });

  it('accepts a non-empty next section', () => {
    expect(hasAvailablePractice({ ready: 1 })).toBe(true);
  });
});

describe('totalReady', () => {
  it('sums ready cards across courses', () => {
    const perCourse = [{ ready: 4 }, { ready: 0 }, { ready: 7 }];
    const sum = perCourse.reduce((total, stats) => total + stats.ready, 0);
    expect(totalReady(perCourse)).toBe(sum);
    expect(totalReady([])).toBe(0);
  });
});

describe('busiestCourse', () => {
  it('picks the course with the most ready cards', () => {
    expect(
      busiestCourse([
        { courseId: 'a', ready: 4 },
        { courseId: 'b', ready: 7 },
        { courseId: 'c', ready: 7 },
      ]),
    ).toEqual({ courseId: 'b', ready: 7 });
  });

  it('returns nothing when no course has cards ready', () => {
    expect(busiestCourse([{ courseId: 'a', ready: 0 }])).toBeUndefined();
  });
});

describe('todayActionLabel', () => {
  const french = { name: 'Französisch', ready: 20 };
  const latin = { name: 'Latein', ready: 1 };
  const otherCourses = 15;

  it('stays plain when the course holds every ready card', () => {
    expect(todayActionLabel(french, french.ready)).toBe('Jetzt üben');
  });

  it('names the course and its own count otherwise', () => {
    expect(todayActionLabel(french, french.ready + otherCourses)).toBe(
      'Französisch üben · 20 Karten',
    );
    expect(todayActionLabel(latin, latin.ready + otherCourses)).toBe(
      'Latein üben · 1 Karte',
    );
  });
});
