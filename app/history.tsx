import { router } from 'expo-router';
import React, { useState } from 'react';
import { LayoutAnimation, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, UIManager, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useHistoryStore } from '../src/store/historyStore';
import { getWorkoutByDay } from '../src/data/workouts';
import { formatHoursMinutes, formatDate } from '../src/utils/time';
import { WorkoutSession } from '../src/types';

const DAY_ABBR: Record<string, string> = {
  monday: 'MON', tuesday: 'TUE', thursday: 'THU', friday: 'FRI',
};

function computeExerciseStats(session: WorkoutSession) {
  const byEx: Record<string, { name: string; setDurations: number[]; breakDurations: number[] }> = {};
  for (const r of session.setRecords) {
    if (!byEx[r.exerciseId]) byEx[r.exerciseId] = { name: r.exerciseName, setDurations: [], breakDurations: [] };
    if (r.actualSetDuration != null) byEx[r.exerciseId].setDurations.push(r.actualSetDuration);
    // Only count real breaks — the last set of each exercise has no between-set
    // break (it's followed by a transition), recorded as 0.
    if (r.actualBreakDuration > 0) byEx[r.exerciseId].breakDurations.push(r.actualBreakDuration);
  }
  return Object.values(byEx).map((ex) => {
    const avgSet = ex.setDurations.length
      ? Math.round(ex.setDurations.reduce((a, b) => a + b, 0) / ex.setDurations.length)
      : null;
    const avgBreak = ex.breakDurations.length
      ? Math.round(ex.breakDurations.reduce((a, b) => a + b, 0) / ex.breakDurations.length)
      : null;
    const fmtSet = avgSet !== null ? `${Math.floor(avgSet / 60)}:${(avgSet % 60).toString().padStart(2, '0')}` : '--';
    const fmtBreak = avgBreak !== null ? `${Math.floor(avgBreak / 60)}:${(avgBreak % 60).toString().padStart(2, '0')}` : '--';
    return { name: ex.name, stat: `avg set ${fmtSet}  ·  avg break ${fmtBreak}` };
  });
}

export default function HistoryScreen() {
  const sessions = useHistoryStore((s) => s.sessions);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((cur) => (cur === id ? null : id));
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>HISTORY</Text>
      </View>

      <ScrollView>
        {sessions.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No workouts yet. Complete your first session to see it here.</Text>
          </View>
        )}
        {sessions.map((session) => {
          const isExpanded = expandedId === session.id;
          const workout = getWorkoutByDay(session.day);
          const dayAbbr = DAY_ABBR[session.day] ?? session.day.slice(0, 3).toUpperCase();
          const stats = isExpanded ? computeExerciseStats(session) : [];

          return (
            <View key={session.id}>
              <TouchableOpacity
                onPress={() => toggleExpand(session.id)}
                style={[styles.row, isExpanded ? styles.rowExpanded : {}]}
                activeOpacity={0.7}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.rowMeta}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>{dayAbbr}</Text>
                    </View>
                    <Text style={styles.dateText}>{formatDate(session.date)}</Text>
                  </View>
                  <Text style={styles.muscleText}>{workout?.muscleGroups ?? '—'}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.durationText}>{formatHoursMinutes(session.totalDuration)}</Text>
                  <Text style={styles.setsText}>{session.setRecords.length} sets</Text>
                </View>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.detail}>
                  {stats.map((s) => (
                    <View key={s.name} style={styles.detailRow}>
                      <Text style={styles.detailName}>{s.name}</Text>
                      <Text style={styles.detailStat}>{s.stat}</Text>
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => toggleExpand(session.id)} style={styles.collapseBtn}>
                    <Text style={styles.collapseText}>Collapse ↑</Text>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.divider} />
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginLeft: -10 },
  backIcon: { fontSize: 28, color: '#888', lineHeight: 32 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#F0F0F0' },

  empty: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 22 },

  row: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowExpanded: { backgroundColor: '#111111' },
  rowLeft: { flex: 1 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayBadge: { backgroundColor: '#1C1C1C', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  dayBadgeText: { color: '#888', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  dateText: { fontSize: 13, color: '#888' },
  muscleText: { fontSize: 12, color: '#888', marginTop: 6 },
  rowRight: { alignItems: 'flex-end' },
  durationText: { fontSize: 20, fontWeight: '800', color: '#F0F0F0' },
  setsText: { fontSize: 12, color: '#888', marginTop: 2 },

  detail: { backgroundColor: '#111', paddingHorizontal: 24, paddingVertical: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  detailName: { fontSize: 13, color: '#888', flex: 1 },
  detailStat: { fontSize: 12, color: '#888' },
  collapseBtn: { paddingTop: 8, alignItems: 'center' },
  collapseText: { fontSize: 12, color: '#888' },

  divider: { height: 1, backgroundColor: '#1A1A1A' },
});
