---
name: wordhold
description: Read and add to the user's vocabulary in Wordhold with the wordhold command. Use when the user asks about the words, terms or texts they are learning, whether they already have a word, how their practice is going, which words they keep getting wrong, or wants a word they came across added or an entry corrected.
---

# Wordhold

Run `wordhold --help` for commands and `wordhold <command> --help` for options. Output is JSON on stdout. Errors are JSON on stderr, `{"error":{"tag","message"}}`, and exit 1, or 2 for invalid arguments. Messages from Wordhold itself, such as a duplicate word, are in German.

- If a command reports `NotSignedIn`, ask the user to run `wordhold login` in their own terminal. It opens the browser and waits for the user to approve the code there, so don't run it yourself. `wordhold status` shows who is signed in.
- Use the ids that commands print. `wordhold courses list` gives each course's id and kind; `wordhold courses get <id>` lists a language course's books and units.
- A course's kind says what an entry's two texts are. In a `language` course, `targetText` is the word in the course's `targetLanguage` and `nativeText` its German meaning, and words live in books and units. In a `terms` course they are a German term and its definition; in a `texts` course a title and the text to learn word for word. Terms and texts have no books, units or examples.
- Before adding, search with `wordhold entries search` and ask the user before adding something the course already has. Like the app, Wordhold refuses only an exact repeat, with the same spelling and example sentence; the same word in another case or with another example is saved as a second entry. Write words the way the course's other entries are written, for example with or without an article.
- Pass `--example` only for a sentence the user actually came across, never one you made up. Wordhold stores it as found rather than AI-written, and the app can write examples itself.
- Change an entry only when the user asks or agrees. Changing a word's `targetText` records its pronunciation again, and changing a term's definition clears its key points until the app derives them again.
- A word with synonyms or antonyms gets a practice card that asks for them, and `--no-synonyms` or `--no-antonyms` deletes that card with its schedule. The course asks these cards only while "Synonyme und Gegenteile" is switched on in its settings, which `wordhold courses get` shows as `to_synonym` and `to_antonym` in `directions`.
- Deleting or moving entries, a course's practice directions, and new courses, books and units are done in the app, not with this command.
