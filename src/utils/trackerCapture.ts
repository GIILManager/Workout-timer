import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import { useTrackerStore } from '../store/trackerStore';
import { parseBodyweightImage, parseTrackerImage } from './claudeClient';
import { weekKey } from './week';
import { TrackerEntry } from '../types';

export type CaptureResult =
  | { status: 'saved'; entry: TrackerEntry }
  | { status: 'cancelled' }
  | { status: 'no-key' }
  | { status: 'no-permission' }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export type BodyweightCaptureResult =
  | { status: 'saved'; kg: number }
  | { status: 'cancelled' }
  | { status: 'no-key' }
  | { status: 'no-permission' }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export type CaptureSource = 'camera' | 'library';

/** Open the camera or photo library and return a base64 JPEG, or a failure status. */
async function grabImage(
  source: CaptureSource,
): Promise<{ ok: true; base64: string } | { ok: false; status: 'cancelled' | 'no-permission' }> {
  let shot: ImagePicker.ImagePickerResult;
  if (source === 'library') {
    // Existing photo (e.g. taken earlier). The Android photo picker needs no
    // runtime permission.
    shot = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.5,
      allowsEditing: true,
      mediaTypes: ['images'],
    });
  } else {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return { ok: false, status: 'no-permission' };
    shot = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.5,
      allowsEditing: true,
    });
  }
  if (shot.canceled || !shot.assets?.[0]?.base64) return { ok: false, status: 'cancelled' };
  return { ok: true, base64: shot.assets[0].base64 };
}

/**
 * Full capture flow shared by the Tracker screen and the post-workout screen:
 * checks the API key, opens the camera, parses the page with Claude, and saves
 * the entry. UI concerns (alerts, busy state, navigation) stay in the caller.
 */
export async function runTrackerCapture(source: CaptureSource = 'camera'): Promise<CaptureResult> {
  const { apiKey, addEntry } = useTrackerStore.getState();
  if (!apiKey) return { status: 'no-key' };

  const img = await grabImage(source);
  if (!img.ok) return { status: img.status };

  try {
    const parsed = await parseTrackerImage(img.base64, apiKey);
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

/**
 * Photo → Claude → bodyweight entry: reads a scale photo (camera or library)
 * and logs the weight for this week so it flows into the weekly CSV alongside
 * the manually-typed weigh-ins.
 */
export async function runBodyweightCapture(
  source: CaptureSource = 'camera',
): Promise<BodyweightCaptureResult> {
  const { apiKey, addBodyweight } = useTrackerStore.getState();
  if (!apiKey) return { status: 'no-key' };

  const img = await grabImage(source);
  if (!img.ok) return { status: img.status };

  try {
    const parsed = await parseBodyweightImage(img.base64, apiKey);
    if (parsed.kg == null) return { status: 'empty' };
    await addBodyweight(parsed.kg);
    return { status: 'saved', kg: parsed.kg };
  } catch (e: any) {
    return { status: 'error', message: e?.message ?? 'Failed to read the weight.' };
  }
}
