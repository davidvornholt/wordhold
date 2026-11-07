// How far along a made-up word is. Each kind but the first two is a history
// of answers that the real scheduler replays, so the card ends up where
// practice would have put it on the day the sample data is written.
export const progressKinds = [
  // Not met yet, so the learning pass offers it.
  'unmet',
  // Met in the learning pass minutes ago; its first answer is waiting.
  'met',
  // Answered once a few hours ago and asked again now.
  'learning',
  // Learned a few days ago and due today.
  'due',
  // Learned weeks ago and left waiting since.
  'overdue',
  // Forgotten two days ago and being relearned.
  'relearning',
  // Forgotten twice in the last weeks, so the dashboard lists it as fragile.
  'fragile',
  // Answered earlier today and back in about two weeks.
  'today',
  // Back in about seven weeks.
  'known',
  // Back in months.
  'mastered',
] as const;
export type Progress = (typeof progressKinds)[number];

export type AnsweredProgress = Exclude<Progress, 'unmet' | 'met'>;
export type HistoryAnswer = {
  readonly daysAgo: number;
  readonly rating: 'again' | 'good' | 'easy';
};

const answer = (
  daysAgo: number,
  rating: HistoryAnswer['rating'],
): HistoryAnswer => ({
  daysAgo,
  rating,
});

// Every history is one practice could produce: a card in review is never
// answered correctly before it is due, and only a card in review is rated
// easy. The second answer, minutes after the first, is the learning step.
export const histories: Readonly<
  Record<AnsweredProgress, ReadonlyArray<HistoryAnswer>>
> = {
  learning: [answer(0.1, 'good')],
  due: [answer(2.4, 'good'), answer(2.39, 'good')],
  overdue: [answer(26, 'good'), answer(25.99, 'good'), answer(23.9, 'good')],
  relearning: [
    answer(15, 'good'),
    answer(14.99, 'good'),
    answer(12.9, 'good'),
    answer(2, 'again'),
  ],
  fragile: [
    answer(21, 'good'),
    answer(20.99, 'good'),
    answer(18.9, 'good'),
    answer(12, 'again'),
    answer(11.99, 'good'),
    answer(6, 'again'),
    answer(5.99, 'good'),
  ],
  today: [answer(3.5, 'good'), answer(3.49, 'good'), answer(0.2, 'good')],
  known: [
    answer(27, 'good'),
    answer(26.99, 'good'),
    answer(24.9, 'good'),
    answer(8, 'good'),
  ],
  mastered: [
    answer(30, 'good'),
    answer(29.99, 'good'),
    answer(27.9, 'easy'),
    answer(5, 'easy'),
  ],
};
