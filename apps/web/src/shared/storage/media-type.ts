const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const mimeForPath = (path: string): string =>
  mimeByExtension[path.slice(path.lastIndexOf('.') + 1)] ?? 'image/jpeg';
