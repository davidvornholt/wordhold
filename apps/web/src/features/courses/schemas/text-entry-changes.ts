import { Schema } from 'effect';
import {
  EntryText,
  MemorizedText,
} from '../../../shared/vocabulary/entry-fields';

// A text of a collection, learned word for word. The title, such as a Bible
// reference, is what the card shows.
export const CreateTextEntry = Schema.Struct({
  courseId: Schema.UUID,
  title: EntryText,
  text: MemorizedText,
});
export type CreateTextEntryData = typeof CreateTextEntry.Type;

// A title and text as the learner corrected them. The card keeps its
// schedule.
export const UpdateTextEntry = Schema.Struct({
  courseId: Schema.UUID,
  entryId: Schema.UUID,
  title: EntryText,
  text: MemorizedText,
});
export type UpdateTextEntryData = typeof UpdateTextEntry.Type;

export const decodeCreateTextEntry = Schema.decodeUnknownSync(CreateTextEntry);
export const decodeUpdateTextEntry = Schema.decodeUnknownSync(UpdateTextEntry);
