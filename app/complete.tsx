import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHistoryStore } from '../src/store/historyStore';
import { formatHoursMinutes } from '../src/utils/time';
import { runTrackerCapture } from '../src/utils/trackerCapture';
import { handleCaptureResult } from './tracker';

export default function CompleteScreen() {
  const sessions = useHistoryStore((s) => s.sessions);
  const latest = sessions[0] ?? null;
  const [capturing, setCapturing] = useState(false);

  async function capturePage() {
    setCapturing(true);
    try {
      const result = await runTrackerCapture();
      const saved = handleCaptureResult(result);
      if (saved) router.replace('/tracker');
    } finally {
      setCapturing(false);
    }
  }

  if (!latest) {
    return (
      <SafeAreaView style={styles.screen}>
        <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/')}>
          <Text style={styles.doneBtnText}>DONE</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const totalSets = latest.setRecords.length;
  const totalDuration = latest.totalDuration;

  const byExercise: Record<string, { name: string; count: number }> = {};
  for (const r of latest.setRecords) {
    if (!byExercise[r.exerciseId]) byExercise[r.exerciseId] = { name: r.exerciseName, count: 0 };
    byExercise[r.exerciseId].count++;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View style={styles.hero}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkMark}>✓</Text>
          </View>
          <Text style={styles.title}>WORKOUT COMPLETE</Text>
          <Text style={styles.duration}>{formatHoursMinutes(totalDuration)}</Text>
          <Text style={styles.durationLabel}>total time</Text>
        </View>

        <View style={styles.statsCard}>
          <View>
            <Text style={styles.statLabel}>Exercises</Text>
            <Text style={styles.statValue}>{latest.exercisesCompleted}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.statLabel}>Sets Done</Text>
            <Text style={styles.statValue}>{totalSets}</Text>
          </View>
        </View>

        <View style={styles.breakdown}>
          <Text style={styles.breakdownTitle}>Session Breakdown</Text>
          {Object.values(byExercise).map((ex) => (
            <View key={ex.name} style={styles.breakdownRow}>
              <Text style={styles.breakdownName}>{ex.name}</Text>
              <Text style={styles.breakdownSets}>{ex.count} sets</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.doneBtn, capturing && styles.btnBusy]}
          onPress={capturePage}
          disabled={capturing}
          activeOpacity={0.85}
        >
          {capturing ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color="#000" />
              <Text style={styles.doneBtnText}>Reading page…</Text>
            </View>
          ) : (
            <Text style={styles.doneBtnText}>📷  Log tracker page</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace('/')}
          activeOpacity={0.7}
          disabled={capturing}
        >
          <Text style={styles.secondaryText}>Skip — back to home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' },

  hero: { paddingTop: 64, paddingHorizontal: 24, alignItems: 'center' },
  checkCircle: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#22D46E',
    alignItems: 'center', justifyContent: 'center',
  },
  checkMark: { fontSize: 36, color: '#fff', fontWeight: '900' },
  title: { fontSize: 26, fontWeight: '900', color: '#F0F0F0', letterSpacing: -0.5, textAlign: 'center', marginTop: 24 },
  duration: { fontSize: 56, fontWeight: '900', color: '#22D46E', textAlign: 'center', marginTop: 8, lineHeight: 64 },
  durationLabel: { fontSize: 13, color: '#888', textAlign: 'center', marginTop: 6 },

  statsCard: {
    marginHorizontal: 24, marginTop: 32,
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12,
    padding: 20, flexDirection: 'row', justifyContent: 'space-between',
  },
  statLabel: { fontSize: 10, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
  statValue: { fontSize: 28, fontWeight: '800', color: '#F0F0F0', marginTop: 4 },

  breakdown: { marginHorizontal: 24, marginTop: 16 },
  breakdownTitle: { fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 },
  breakdownRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A2A2A',
  },
  breakdownName: { fontSize: 14, fontWeight: '500', color: '#F0F0F0' },
  breakdownSets: { fontSize: 13, color: '#888' },

  ctaContainer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, paddingBottom: 32, gap: 10,
  },
  doneBtn: {
    height: 64, borderRadius: 16, backgroundColor: '#22D46E',
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },
  btnBusy: { opacity: 0.85 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secondaryBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#888', fontSize: 15, fontWeight: '600' },
});
