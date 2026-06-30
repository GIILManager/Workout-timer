import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BEEP = require('../../assets/sounds/beep.wav');

let alertTimeout: ReturnType<typeof setTimeout> | null = null;
let sound: Audio.Sound | null = null;
let loading: Promise<void> | null = null;

async function ensureSound(): Promise<void> {
  if (sound) return;
  if (!loading) {
    loading = (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
        });
        const { sound: s } = await Audio.Sound.createAsync(BEEP);
        sound = s;
      } catch {
        sound = null;
      }
    })();
  }
  await loading;
}

async function playBeep(): Promise<void> {
  try {
    await ensureSound();
    if (sound) {
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
  } catch {}
}

/**
 * Fire the timer alert: sound + heavy haptic, repeated `pulses` times, then
 * silence. Used identically for the SET target and the BREAK/transition end
 * so every phase signals when its allotted time is up.
 */
export async function triggerTimerAlert(pulses = 2): Promise<void> {
  if (alertTimeout) return;

  let count = 0;
  const fire = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
    playBeep();
    count++;
    if (count < pulses) {
      alertTimeout = setTimeout(fire, 700);
    } else {
      alertTimeout = setTimeout(() => {
        alertTimeout = null;
      }, 700);
    }
  };
  await fire();
}

export function stopAlert(): void {
  if (alertTimeout) {
    clearTimeout(alertTimeout);
    alertTimeout = null;
  }
}

/** Preload the beep so the first alert isn't delayed. */
export function warmUpAlert(): void {
  ensureSound();
}
