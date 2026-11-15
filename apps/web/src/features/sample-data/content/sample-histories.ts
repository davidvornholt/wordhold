// How far along a made-up word is. Each kind but the first two is a history
// of answers that the real scheduler replays, so the card ends up where
// practice would have put it on the day the sample data is written.
export const progressKinds = [
  // Not met yet, so the learning pass offers it.
  'unmet',
  // Met in the learning pass minutes ago; its first answer is waiting.
  'met',
  // Missed a few hours ago and asked again now.
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
  // Back in two to three months.
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
// easy. A first correct answer graduates the card straight to review, so
// only a miss keeps it in learning.
export const histories: Readonly<
  Record<AnsweredProgress, ReadonlyArray<HistoryAnswer>>
> = {
  learning: [answer(0.1, 'again')],
  due: [answer(4.8, 'good')],
  overdue: [answer(40, 'good'), answer(35, 'good')],
  relearning: [answer(15, 'good'), answer(10, 'good'), answer(2, 'again')],
  fragile: [
    answer(21, 'good'),
    answer(12, 'again'),
    answer(11.3, 'good'),
    answer(6, 'again'),
    answer(5.3, 'good'),
  ],
  today: [
    answer(8, 'again'),
    answer(7.9, 'good'),
    answer(7.8, 'good'),
    answer(4.6, 'good'),
    answer(0.2, 'good'),
  ],
  known: [answer(45, 'good'), answer(40, 'good'), answer(13, 'good')],
  mastered: [answer(80, 'good'), answer(75, 'easy'), answer(20, 'easy')],
};
