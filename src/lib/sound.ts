import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import { useSettings } from '../store/settings';
import { pickVariant } from './motion';

// Sounds are short, quiet and optional. They follow the phone's silent switch and mix with other audio.
const SOURCES = {
  snap: [require('../../assets/sounds/snap1.wav'), require('../../assets/sounds/snap2.wav'), require('../../assets/sounds/snap3.wav')],
  merge: [require('../../assets/sounds/merge.wav')],
  solved: [require('../../assets/sounds/solved.wav')],
} as const;
type Kind = keyof typeof SOURCES;

const players: Partial<Record<Kind, AudioPlayer[]>> = {};
let lastSnap = -1;
let ready = false;

const on = () => Platform.OS !== 'web' && useSettings.getState().sound;

function init() {
  if (ready) return;
  ready = true;
  setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
}

function play(kind: Kind, index: number, volume: number) {
  if (!on()) return;
  try {
    init();
    const list = (players[kind] ??= SOURCES[kind].map((src) => createAudioPlayer(src)));
    const p = list[index];
    p.volume = volume;
    p.seekTo(0).catch(() => {});
    p.play();
  } catch {
    // Sound is a nicety; never let it break play.
  }
}

export const sound = {
  /** Piece locks into place. Variants rotate so repeats never sound identical. */
  snap: () => { lastSnap = pickVariant(SOURCES.snap.length, lastSnap); play('snap', lastSnap, 0.7); },
  /** Two groups join (an octave lower than a snap). */
  merge: () => play('merge', 0, 0.7),
  /** Puzzle solved chime. */
  solved: () => play('solved', 0, 0.8),
};
