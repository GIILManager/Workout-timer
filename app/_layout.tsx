import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useHistoryStore } from '../src/store/historyStore';
import { useTrackerStore } from '../src/store/trackerStore';
import {
  ensureWeeklyExportReminder,
  setupNotifications,
} from '../src/utils/notificationService';
import { warmUpAlert } from '../src/utils/alertService';
// Side effect: registers the notification action-button handlers (foreground +
// background) so "Done"/"Start next set" work from the shade and lock screen.
import '../src/utils/notificationHandlers';

export default function RootLayout() {
  const hydrate = useHistoryStore((s) => s.hydrate);
  const hydrateTracker = useTrackerStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    hydrateTracker().then(() => {
      ensureWeeklyExportReminder(useTrackerStore.getState().lastExportWeekKey);
    });
    setupNotifications();
    warmUpAlert();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="workout/index" />
          <Stack.Screen name="complete" />
          <Stack.Screen name="history" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="tracker" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
