import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useHistoryStore } from '../src/store/historyStore';

export default function RootLayout() {
  const hydrate = useHistoryStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="workout/index" />
        <Stack.Screen name="complete" />
        <Stack.Screen name="history" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}
