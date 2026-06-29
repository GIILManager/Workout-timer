import * as Haptics from 'expo-haptics';

let alertTimeout: ReturnType<typeof setTimeout> | null = null;

export async function triggerTimerAlert(): Promise<void> {
  if (alertTimeout) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    alertTimeout = setTimeout(async () => {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } catch {}
      alertTimeout = null;
    }, 1000);
  } catch {}
}

export function stopAlert(): void {
  if (alertTimeout) {
    clearTimeout(alertTimeout);
    alertTimeout = null;
  }
}
