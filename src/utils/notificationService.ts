import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let initialized = false;

export async function setupNotifications(): Promise<void> {
  if (initialized) return;
  initialized = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    // High-importance channel for the end-of-phase alert (sound + vibration).
    await Notifications.setNotificationChannelAsync('workout-alerts', {
      name: 'Workout alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#22D46E',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false,
    });
    // Low-importance channel for the silent, persistent "timer running" status.
    await Notifications.setNotificationChannelAsync('workout-status', {
      name: 'Workout status',
      importance: Notifications.AndroidImportance.LOW,
      vibrationPattern: [0],
      lightColor: '#22D46E',
      sound: null,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

/** Schedule the end-of-phase alert (fires with sound even when backgrounded). */
export async function scheduleAlert(
  seconds: number,
  title: string,
  body: string,
): Promise<string | null> {
  if (seconds <= 0) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: 'workout-alerts',
      },
    });
  } catch {
    return null;
  }
}

export async function cancelAlert(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
  try {
    // If it already fired, clear the delivered notification too.
    await Notifications.dismissNotificationAsync(id);
  } catch {}
}

/**
 * Present an ongoing (sticky) status notification so the running timer stays
 * visible in the notification shade while the app is backgrounded. Silent —
 * the audible alert is handled separately by scheduleAlert.
 */
export async function presentOngoing(
  title: string,
  body: string,
): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: false,
        sticky: true,
        autoDismiss: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
      },
      trigger: Platform.OS === 'android' ? { channelId: 'workout-status' } as any : null,
    });
  } catch {
    return null;
  }
}

export async function dismissOngoing(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.dismissNotificationAsync(id);
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}
