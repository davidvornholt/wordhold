import { Schema } from 'effect';
import {
  maximumEntriesPerPage,
  maximumEntryTextLength,
} from '../extraction/schema';

// The side of the photo the tops of the letters point to: up for an upright
// page, right for a page photographed turned a quarter to the right.
export const TextTop = Schema.Literals(['up', 'right', 'down', 'left']);
export type TextTopData = typeof TextTop.Type;

export const NoteTerm = Schema.Struct({
  term: Schema.String.check(Schema.isMaxLength(maximumEntryTextLength)),
  definition: Schema.String.check(Schema.isMaxLength(maximumEntryTextLength)),
  confidence: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
});
export type NoteTermData = typeof NoteTerm.Type;

export const NotesPage = Schema.Struct({
  textTop: TextTop,
  terms: Schema.Array(NoteTerm).check(
    Schema.isMaxLength(maximumEntriesPerPage),
  ),
});
export type NotesPageData = typeof NotesPage.Type;
