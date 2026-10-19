import { NotesPage } from '@wordhold/ai/notes/schema';
import { Option, Schema } from 'effect';
import type { NotesReading } from '../services/repository';

const StoredNotesReading = Schema.Struct({
  notes: NotesPage,
  modelId: Schema.String,
});

const decodeStoredNotesReading = Schema.decodeUnknownOption(StoredNotesReading);

// A page's stored reading as terms. Null while the page waits for a reading,
// or when it holds none the review can use; the learner then reads it again.
export const notesReadingFrom = (extraction: unknown): NotesReading | null =>
  Option.getOrNull(decodeStoredNotesReading(extraction));
