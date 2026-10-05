import { createVertex } from '@ai-sdk/google-vertex';
import { Config, Context, Effect, Layer, Redacted, Schema } from 'effect';

const vertexLocation = Config.String('GOOGLE_VERTEX_LOCATION');
const googleServiceAccountJson = Config.Redacted('GOOGLE_SERVICE_ACCOUNT_JSON');

// Google service-account key files use snake_case; rename on decode so the
// external format stays at this boundary.
const ServiceAccountKey = Schema.Struct({
  projectId: Schema.String,
  clientEmail: Schema.String,
  privateKey: Schema.String,
}).pipe(
  Schema.encodeKeys({
    projectId: 'project_id',
    clientEmail: 'client_email',
    privateKey: 'private_key',
  }),
);

type GoogleAuthOptions = NonNullable<
  NonNullable<Parameters<typeof createVertex>[0]>['googleAuthOptions']
>;

export class VertexProvider extends Context.Service<
  VertexProvider,
  ReturnType<typeof createVertex>
>()('@wordhold/ai/Vertex') {
  static readonly live = Layer.effect(
    VertexProvider,
    Effect.gen(function* () {
      const location = yield* vertexLocation;
      const raw = Redacted.value(yield* googleServiceAccountJson);
      const parsed: unknown = JSON.parse(raw);
      const key = yield* Schema.decodeUnknownEffect(ServiceAccountKey)(parsed);
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
