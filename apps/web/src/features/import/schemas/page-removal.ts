import { Schema } from 'effect';
import { Uuid } from '../../../shared/validate/uuid';
import { maximumUploadBatchSize } from '../services/upload-queue';

const QueuePosition = Schema.Number.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: maximumUploadBatchSize - 1 }),
);

export const PageRemovalRequest = Schema.Struct({
  courseId: Uuid,
  importSessionId: Uuid,
  pageId: Uuid,
  position: QueuePosition,
  queue: Schema.Array(
    Schema.Struct({ pageId: Uuid, position: QueuePosition }),
  ).check(Schema.isMinLength(1), Schema.isMaxLength(maximumUploadBatchSize)),
});

export const decodePageRemovalRequest =
  Schema.decodeUnknownSync(PageRemovalRequest);
