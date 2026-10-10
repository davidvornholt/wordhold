import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { maximumUploadBatchSize } from '../services/upload-queue';

export const PageRemovalRequest = Schema.Struct({
  courseId: Uuid,
  importSessionId: Uuid,
  pageId: Uuid,
  position: Schema.Number.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: maximumUploadBatchSize - 1 }),
  ),
});

export const decodePageRemovalRequest =
  Schema.decodeUnknownSync(PageRemovalRequest);
