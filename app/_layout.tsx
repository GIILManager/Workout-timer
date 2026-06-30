import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useHistoryStore } from '../src/store/historyStore';
import { setupNotifications } from '../src/utils/notificationService';

export default function RootLayout() {
  const hydrate = useHistoryStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    setupNotifications();
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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
