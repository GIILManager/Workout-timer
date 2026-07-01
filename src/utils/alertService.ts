import * as Haptics from 'expo-haptics';
import { Vibration } from 'react-native';
import { Audio } from 'expo-av';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BEEP = require('../../assets/sounds/beep.wav');

let alertBusy = false;
let pulseTimeout: ReturnType<typeof setTimeout> | null = null;
let sustainTimeout: ReturnType<typeof setTimeout> | null = null;
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
      await sound.setIsLoopingAsync(false);
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
  } catch {}
}

/**
 * Short multi-pulse alert: sound + heavy haptic, repeated `pulses` times, then
 * silence. Used for the BREAK / transition end so you know the rest is over.
 */
export async function triggerTimerAlert(pulses = 2): Promise<void> {
  if (alertBusy) return;
  alertBusy = true;

  let count = 0;
  const fire = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
    playBeep();
    count++;
    if (count < pulses) {
      pulseTimeout = setTimeout(fire, 700);
    } else {
      pulseTimeout = setTimeout(() => {
        alertBusy = false;
        pulseTimeout = null;
      }, 700);
    }
  };
  await fire();
}

/**
 * Sustained ~2s beep + vibration for the SET target being hit: you're now OVER
 * your allotted set time and need to notice immediately, even mid-rep. The beep
 * loops and the phone buzzes continuously for the whole window. Interrupted
 * early by stopAlert() when you tap DONE.
 */
export async function triggerSustainedAlert(durationMs = 2000): Promise<void> {
  if (alertBusy) return;
  alertBusy = true;

  // Android honours the millisecond duration → one continuous buzz.
  try {
    Vibration.vibrate(durationMs);
  } catch {}

  try {
    await ensureSound();
    if (sound) {
      await sound.setIsLoopingAsync(true);
      await sound.setPositionAsync(0);
      await sound.playAsync();
    }
  } catch {}

  sustainTimeout = setTimeout(() => {
    stopAlert();
  }, durationMs);
}

export function stopAlert(): void {
  if (pulseTimeout) {
    clearTimeout(pulseTimeout);
    pulseTimeout = null;
  }
  if (sustainTimeout) {
    clearTimeout(sustainTimeout);
    sustainTimeout = null;
  }
  try {
    Vibration.cancel();
  } catch {}
  if (sound) {
    sound.stopAsync().catch(() => {});
    sound.setIsLoopingAsync(false).catch(() => {});
  }
  alertBusy = false;
}

/** Preload the beep so the first alert isn't delayed. */
export function warmUpAlert(): void {
  ensureSound();
}
