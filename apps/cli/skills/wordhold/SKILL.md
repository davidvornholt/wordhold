---
name: wordhold
description: Use when the user asks about or wants to change the vocabulary, terms or texts they are learning, or prepares for a vocabulary test.
---

# Wordhold

Run `wordhold --help` for commands and `wordhold <command> --help` for options.

- If a command reports `NotSignedIn`, ask the user to run `wordhold login` in their own terminal, because it waits for them to approve a code in the browser.
- A course's kind says what an entry's two texts are. In a `language` course, `targetText` is the word in the course's `targetLanguage` and `nativeText` its German meaning. In a `terms` course they are a German term and its definition, and in a `texts` course a title and the text to learn word for word.
- Before adding, search with `wordhold entries search` and ask the user before adding something the course already has, because Wordhold refuses only an exact repeat. Write words the way the course's other entries are written, for example with or without an article.
- Wordhold stores an `--example` as one the user came across. Write one yourself only when the user asks, and pass `--example-by-ai` with it.
- Change entries, create units or move words only when the user asks or agrees. Changing a word's `targetText` records its pronunciation again, changing a term's definition clears its key points, and `--no-synonyms` or `--no-antonyms` deletes that practice card with its schedule.
- `wordhold exams get` shows how the last two rounds of a test went. Report its numbers rather than a verdict of your own on whether the user is ready. Cards the user hasn't learned yet aren't asked; `cards.unlearned` counts them.
- Due times such as `nextDueAt` are UTC instants. A card due on a later day than its last answer is due from the start of that day in the user's time zone, so name the day, and give a time only for a card due later today.
