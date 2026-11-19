import { SquareIcon, Volume2Icon } from 'lucide-react';
import type { SoundControl } from '../audio/use-pronunciation-audio';
import { Button } from './button';

type SoundButtonProps = {
  // What it plays, as an action: "Wort anhören".
  readonly label: string;
  readonly sound: SoundControl;
};

// Plays one sound from beside what it says, and stops it while it plays, so
// a card needs no separate control to stop the audio.
export const SoundButton = ({ label, sound }: SoundButtonProps) => (
  <Button
    aria-label={sound.playing ? 'Audio stoppen' : label}
    className="-my-2 shrink-0 self-center"
    onClick={() => {
      if (sound.playing) {
        sound.stop();
        return;
      }
      sound.play().catch(() => undefined);
    }}
    title={sound.playing ? 'Audio stoppen' : label}
    variant="icon"
  >
    {sound.playing ? (
      <SquareIcon aria-hidden="true" className="size-3.5 fill-current" />
    ) : (
      <Volume2Icon aria-hidden="true" className="size-5" />
    )}
  </Button>
);
