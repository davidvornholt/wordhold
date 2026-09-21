import { describe, expect, it } from 'bun:test';
import { pastedImages } from './use-pasted-images';

const clipboardWith = (files: ReadonlyArray<File>) => ({ files });

describe('pastedImages', () => {
  it('keeps the image formats the upload accepts', () => {
    const screenshot = new File(['png'], 'image.png', { type: 'image/png' });
    const photo = new File(['jpg'], 'page.jpg', { type: 'image/jpeg' });
    const text = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const gif = new File(['gif'], 'anim.gif', { type: 'image/gif' });
    expect(pastedImages(clipboardWith([screenshot, text, photo, gif]))).toEqual(
      [screenshot, photo],
    );
  });

  it('yields nothing for an empty or missing clipboard', () => {
    expect(pastedImages(null)).toEqual([]);
    expect(pastedImages(clipboardWith([]))).toEqual([]);
  });
});
