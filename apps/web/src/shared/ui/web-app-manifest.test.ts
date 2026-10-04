import { describe, expect, it } from 'bun:test';
import { file } from 'bun';
import { imageDimensionsFromData } from 'image-dimensions';

const publicDirectory = `${import.meta.dir}/../../../public`;

type ManifestIcon = {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
  readonly purpose: string;
};

const manifest: {
  readonly icons: ReadonlyArray<ManifestIcon>;
} = await file(`${publicDirectory}/manifest.webmanifest`).json();

const iconSize = async (src: string) => {
  const dimensions = imageDimensionsFromData(
    await file(`${publicDirectory}${src}`).bytes(),
  );
  return `${dimensions?.width}x${dimensions?.height} ${dimensions?.type}`;
};

describe('web app manifest', () => {
  it('has what browsers require to install Wordhold as an app', () => {
    expect(manifest).toMatchObject({
      name: 'Wordhold',
      // biome-ignore lint/style/useNamingConvention: Web app manifest members are snake_case.
      start_url: '/',
      display: 'standalone',
    });
    expect(
      manifest.icons.map((icon) => `${icon.sizes} ${icon.purpose}`),
    ).toEqual(['192x192 any', '512x512 any', '512x512 maskable']);
  });

  it('declares every icon with its actual size and format', async () => {
    expect(
      await Promise.all(manifest.icons.map((icon) => iconSize(icon.src))),
    ).toEqual(
      manifest.icons.map(
        (icon) => `${icon.sizes} ${icon.type.replace('image/', '')}`,
      ),
    );
    // iOS takes the home screen icon from the root route's
    // apple-touch-icon link instead of the manifest.
    expect(await iconSize('/apple-touch-icon.png')).toBe('180x180 png');
  });
});
