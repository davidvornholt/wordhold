import { createVertex } from '@ai-sdk/google-vertex';
import { Context, Effect, Layer, Redacted, Schema } from 'effect';
import { googleServiceAccountJson, vertexLocation } from '../config';

// Google service-account key files use snake_case; rename on decode so the
// external format stays at this boundary.
const ServiceAccountKey = Schema.Struct({
  projectId: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey('project_id'),
  ),
  clientEmail: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey('client_email'),
  ),
  privateKey: Schema.propertySignature(Schema.String).pipe(
    Schema.fromKey('private_key'),
  ),
});

type GoogleAuthOptions = NonNullable<
  NonNullable<Parameters<typeof createVertex>[0]>['googleAuthOptions']
>;

export class VertexProvider extends Context.Tag('@wordhold/ai/Vertex')<
  VertexProvider,
  ReturnType<typeof createVertex>
>() {
  static readonly live = Layer.effect(
    VertexProvider,
    Effect.gen(function* () {
      const location = yield* vertexLocation;
      const raw = Redacted.value(yield* googleServiceAccountJson);
      const parsed: unknown = JSON.parse(raw);
      const key = yield* Schema.decodeUnknown(ServiceAccountKey)(parsed);
      return createVertex({
        project: key.projectId,
        location,
        // google-auth-library expects the original snake_case key material.
        googleAuthOptions: {
          credentials: parsed as GoogleAuthOptions['credentials'],
        },
      });
    }),
  );
}
