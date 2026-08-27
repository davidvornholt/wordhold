import { Schema } from 'effect';

const CredentialId = Schema.propertySignature(Schema.String).pipe(
  Schema.fromKey('ServiceSpecificCredentialId'),
);

export const ListedCredentials = Schema.Struct({
  credentials: Schema.propertySignature(
    Schema.Array(Schema.Struct({ id: CredentialId })),
  ).pipe(Schema.fromKey('ServiceSpecificCredentials')),
});

export const CreatedCredential = Schema.Struct({
  credential: Schema.propertySignature(
    Schema.Struct({
      id: CredentialId,
      value: Schema.propertySignature(Schema.String).pipe(
        Schema.fromKey('ServiceCredentialSecret'),
      ),
    }),
  ).pipe(Schema.fromKey('ServiceSpecificCredential')),
});

export const CreatedCredentialIdentity = Schema.Struct({
  credential: Schema.propertySignature(
    Schema.Struct({ id: CredentialId }),
  ).pipe(Schema.fromKey('ServiceSpecificCredential')),
});
