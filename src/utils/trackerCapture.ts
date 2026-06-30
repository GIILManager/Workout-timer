import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useTrackerStore } from '../store/trackerStore';
import { parseTrackerImage } from './claudeClient';
import { weekKey } from './week';
import { TrackerEntry } from '../types';

export type CaptureResult =
  | { status: 'saved'; entry: TrackerEntry }
  | { status: 'cancelled' }
  | { status: 'no-key' }
  | { status: 'no-permission' }
  | { status: 'empty' }
  | { status: 'error'; message: string };

/**
 * Full capture flow shared by the Tracker screen and the post-workout screen:
 * checks the API key, opens the camera, parses the page with Claude, and saves
 * the entry. UI concerns (alerts, busy state, navigation) stay in the caller.
 */
export async function runTrackerCapture(): Promise<CaptureResult> {
  const { apiKey, addEntry } = useTrackerStore.getState();
  if (!apiKey) return { status: 'no-key' };

  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return { status: 'no-permission' };

  const shot = await ImagePicker.launchCameraAsync({
    base64: true,
    quality: 0.5,
    allowsEditing: true,
  });
  if (shot.canceled || !shot.assets?.[0]?.base64) return { status: 'cancelled' };

  try {
    const parsed = await parseTrackerImage(shot.assets[0].base64, apiKey);
    if (parsed.exercises.length === 0) return { status: 'empty' };

    const dayLabel = parsed.day ?? undefined;
    const title = [parsed.month, dayLabel].filter(Boolean).join(' · ') || 'Workout page';

    const entry: TrackerEntry = {
      id: Crypto.randomUUID(),
      capturedAt: new Date().toISOString(),
      weekKey: weekKey(),
      month: parsed.month ?? undefined,
      day: dayLabel,
      weekNumber: parsed.weekNumber,
      weekDate: parsed.weekDate ?? undefined,
      title,
      exercises: parsed.exercises,
      notes: parsed.notes ?? undefined,
      rawText: parsed.rawText,
    };
    await addEntry(entry);
    return { status: 'saved', entry };
  } catch (e: any) {
    return { status: 'error', message: e?.message ?? 'Failed to parse the page.' };
  }
}
