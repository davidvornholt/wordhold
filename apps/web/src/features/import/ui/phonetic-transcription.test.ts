import { describe, expect, it } from 'bun:test';
import { withoutPhoneticTranscription } from './phonetic-transcription';

describe('withoutPhoneticTranscription', () => {
  it('removes a bracketed transcription after the word', () => {
    expect(withoutPhoneticTranscription("hostile ['hɒstaɪl]")).toBe('hostile');
    expect(
      withoutPhoneticTranscription("(to) rebel against sth. [rɪ'bel]"),
    ).toBe('(to) rebel against sth.');
  });

  it('removes British and American transcriptions in one bracket', () => {
    expect(
      withoutPhoneticTranscription(
        "provocative [prə'vɒkətɪv, AE: prə'vɑːkətɪv]",
      ),
    ).toBe('provocative');
  });

  it('removes a transcription between slashes', () => {
    expect(withoutPhoneticTranscription('/ˈhɒstaɪl/ hostile')).toBe('hostile');
  });

  it('keeps brackets and slashes that hold no transcription', () => {
    expect(withoutPhoneticTranscription('le voyage [m]')).toBe('le voyage [m]');
    expect(withoutPhoneticTranscription('he/she/it goes')).toBe(
      'he/she/it goes',
    );
    expect(withoutPhoneticTranscription('to get over sth.')).toBe(
      'to get over sth.',
    );
  });

  it('keeps text that is nothing but a transcription', () => {
    expect(withoutPhoneticTranscription("['hɒstaɪl]")).toBe("['hɒstaɪl]");
  });
});
