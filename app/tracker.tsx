import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTrackerStore, currentWeekKey } from '../src/store/trackerStore';
import { parseTrackerImage } from '../src/utils/claudeClient';
import { buildWeekCsv } from '../src/utils/csv';
import { TrackerEntry } from '../src/types';

export default function TrackerScreen() {
  const entries = useTrackerStore((s) => s.entries);
  const apiKey = useTrackerStore((s) => s.apiKey);
  const addEntry = useTrackerStore((s) => s.addEntry);
  const deleteEntry = useTrackerStore((s) => s.deleteEntry);
  const clearWeeksBefore = useTrackerStore((s) => s.clearWeeksBefore);

  const [busy, setBusy] = useState<null | 'capturing' | 'parsing'>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const week = currentWeekKey();
  const thisWeek = useMemo(() => entries.filter((e) => e.weekKey === week), [entries, week]);
  const olderCount = entries.length - thisWeek.length;

  async function exportCsv(toExport: TrackerEntry[], label: string) {
    if (toExport.length === 0) {
      Alert.alert('Nothing to export', 'No entries for this period yet.');
      return null;
    }
    const csv = buildWeekCsv(toExport);
    const uri = `${FileSystem.cacheDirectory}workout-${label}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: `Workout tracker — ${label}` });
    } else {
      Alert.alert('Sharing unavailable', `CSV written to:\n${uri}`);
    }
    return uri;
  }

  async function handleCapture() {
    if (!apiKey) {
      Alert.alert('API key needed', 'Add your Anthropic API key in Settings to parse photos.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => router.push('/settings') },
      ]);
      return;
    }
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera permission', 'Camera access is needed to photograph your tracker page.');
      return;
    }
    setBusy('capturing');
    try {
      const shot = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.5,
        allowsEditing: true,
      });
      if (shot.canceled || !shot.assets?.[0]?.base64) {
        setBusy(null);
        return;
      }
      setBusy('parsing');
      const parsed = await parseTrackerImage(shot.assets[0].base64, apiKey);
      if (parsed.exercises.length === 0) {
        Alert.alert('Couldn’t read the page', 'No exercises were detected. Try a clearer, well-lit photo.');
        setBusy(null);
        return;
      }
      const entry: TrackerEntry = {
        id: Crypto.randomUUID(),
        capturedAt: new Date().toISOString(),
        weekKey: week,
        title: parsed.title ?? undefined,
        exercises: parsed.exercises,
        rawText: parsed.rawText,
      };
      await addEntry(entry);
      setExpandedId(entry.id);
    } catch (e: any) {
      Alert.alert('Parsing failed', e?.message ?? 'Something went wrong calling the Claude API.');
    } finally {
      setBusy(null);
    }
  }

  async function handleExportThisWeek() {
    await exportCsv(thisWeek, week);
  }

  function handleExportOlder() {
    const older = entries.filter((e) => e.weekKey !== week);
    Alert.alert(
      'Export & clear previous weeks?',
      `Export ${older.length} entr${older.length === 1 ? 'y' : 'ies'} from previous weeks to a CSV, then remove them to start fresh?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export & Clear',
          onPress: async () => {
            const uri = await exportCsv(older, 'previous-weeks');
            if (uri) await clearWeeksBefore(week);
          },
        },
      ],
    );
  }

  function confirmDelete(id: string) {
    Alert.alert('Delete entry?', 'This removes the captured page from this week.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteEntry(id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.title}>TRACKER</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}>
        {!apiKey && (
          <TouchableOpacity style={styles.warnCard} onPress={() => router.push('/settings')} activeOpacity={0.8}>
            <Text style={styles.warnTitle}>Add your Anthropic API key</Text>
            <Text style={styles.warnBody}>
              Photo parsing uses the Claude API. Add your key in Settings → API to enable capture.
            </Text>
          </TouchableOpacity>
        )}

        {olderCount > 0 && (
          <TouchableOpacity style={styles.rolloverCard} onPress={handleExportOlder} activeOpacity={0.85}>
            <Text style={styles.rolloverText}>
              {olderCount} entr{olderCount === 1 ? 'y' : 'ies'} from previous weeks
            </Text>
            <Text style={styles.rolloverAction}>EXPORT & CLEAR ▸</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionLabel}>This week · {week}</Text>

        {thisWeek.length === 0 && (
          <Text style={styles.empty}>No pages logged yet this week. Tap “Capture page” below.</Text>
        )}

        {thisWeek.map((entry) => {
          const expanded = expandedId === entry.id;
          const setCount = entry.exercises.reduce((n, e) => n + e.sets.length, 0);
          return (
            <View key={entry.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => setExpandedId(expanded ? null : entry.id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{entry.title || 'Workout page'}</Text>
                  <Text style={styles.cardMeta}>
                    {entry.capturedAt.slice(0, 10)} · {entry.exercises.length} exercises · {setCount} sets
                  </Text>
                </View>
                <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>

              {expanded && (
                <View style={styles.cardBody}>
                  {entry.exercises.map((ex, i) => (
                    <View key={i} style={styles.exRow}>
                      <Text style={styles.exName}>{ex.name}</Text>
                      <Text style={styles.exSets}>
                        {ex.sets
                          .map((s) => `${s.reps ?? '–'}${s.weight != null ? ` @ ${s.weight}` : ''}`)
                          .join('   ')}
                      </Text>
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => confirmDelete(entry.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>Delete entry</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {thisWeek.length > 0 && (
          <TouchableOpacity style={styles.exportBtn} onPress={handleExportThisWeek} activeOpacity={0.8}>
            <Text style={styles.exportText}>⬇  Export this week (CSV)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[styles.captureBtn, busy != null && styles.captureBtnBusy]}
          onPress={handleCapture}
          disabled={busy != null}
          activeOpacity={0.85}
        >
          {busy != null ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color="#000" />
              <Text style={styles.captureText}>{busy === 'parsing' ? 'Reading page…' : 'Opening camera…'}</Text>
            </View>
          ) : (
            <Text style={styles.captureText}>📷  Capture page</Text>
          )}
        </TouchableOpacity>
      </View>
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

  warnCard: {
    backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 12, padding: 16, marginTop: 12,
  },
  warnTitle: { fontSize: 14, fontWeight: '700', color: '#F59E0B' },
  warnBody: { fontSize: 13, color: '#888', marginTop: 6, lineHeight: 19 },

  rolloverCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(59,130,246,0.10)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)',
    borderRadius: 12, padding: 16, marginTop: 12,
  },
  rolloverText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#F0F0F0' },
  rolloverAction: { fontSize: 12, fontWeight: '800', color: '#3B82F6', letterSpacing: 0.5 },

  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase',
    letterSpacing: 1.5, marginTop: 24, marginBottom: 8,
  },
  empty: { fontSize: 14, color: '#888', lineHeight: 22, paddingVertical: 8 },

  card: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#F0F0F0' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 4 },
  chevron: { fontSize: 16, color: '#888' },
  cardBody: { paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#1A1A1A', paddingTop: 8 },
  exRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  exName: { fontSize: 14, fontWeight: '500', color: '#F0F0F0' },
  exSets: { fontSize: 13, color: '#888', marginTop: 3, fontVariant: ['tabular-nums'] },
  deleteBtn: { paddingTop: 12, alignItems: 'flex-start' },
  deleteText: { fontSize: 13, color: '#EF4444', fontWeight: '600' },

  exportBtn: {
    marginTop: 16, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#262626',
    alignItems: 'center', justifyContent: 'center',
  },
  exportText: { fontSize: 15, fontWeight: '600', color: '#888' },

  ctaContainer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 32 },
  captureBtn: {
    height: 64, borderRadius: 16, backgroundColor: '#22D46E',
    alignItems: 'center', justifyContent: 'center',
  },
  captureBtnBusy: { opacity: 0.85 },
  busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  captureText: { color: '#000', fontSize: 17, fontWeight: '800' },
});
