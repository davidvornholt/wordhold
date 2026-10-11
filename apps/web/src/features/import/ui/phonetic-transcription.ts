// IPA letters and marks: the IPA Extensions and Spacing Modifier Letters
// blocks, U+0250 to U+02FF (ə, ɪ, ˈ, ː …), plus the IPA symbols borrowed
// from other scripts.
const phoneticSymbol = /[ɐ-˿æðθŋøœβχ]/u;
const bracketed = /\[[^\]]*\]/gu;
const slashed = /\/[^/]*\//gu;

// Square brackets also mark stress with a plain apostrophe, as in [rɪ'bel];
// slashes stay unless they hold IPA, so "he/she" keeps its slash.
const isBracketedTranscription = (group: string): boolean =>
  phoneticSymbol.test(group) || group.includes("'");

// Textbooks print the pronunciation beside the word, as in
// "hostile ['hɒstaɪl]". The page reading copies it with the word, but it
// is no part of what the learner types, hears, or is graded on.
export const withoutPhoneticTranscription = (text: string): string => {
  const stripped = text
    .replace(bracketed, (group) =>
      isBracketedTranscription(group) ? ' ' : group,
    )
    .replace(slashed, (group) => (phoneticSymbol.test(group) ? ' ' : group))
    .replace(/\s+/gu, ' ')
    .trim();
  return stripped === '' ? text : stripped;
};
