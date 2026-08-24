export const privateMediaResponse = (
  bytes: Uint8Array<ArrayBuffer>,
  contentType: string,
): Response =>
  new Response(bytes, {
    headers: {
      'cache-control': 'private, no-store',
      'content-type': contentType,
    },
  });
