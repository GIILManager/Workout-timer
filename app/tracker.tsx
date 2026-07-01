import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTrackerStore, currentWeekKey } from '../src/store/trackerStore';
import {
  runTrackerCapture,
  runBodyweightCapture,
  BodyweightCaptureResult,
  CaptureResult,
  CaptureSource,
} from '../src/utils/trackerCapture';
import { buildWeekCsv } from '../src/utils/csv';
import { BodyweightEntry, TrackerEntry, TrackerSet } from '../src/types';

/** Ask whether to use the camera or an existing photo, then run the chosen flow. */
export function promptCaptureSource(
  run: (source: CaptureSource) => void,
  copy?: { title: string; message: string },
) {
  Alert.alert(
    copy?.title ?? 'Log tracker page',
    copy?.message ?? 'Photograph the page now, or pick a photo you already took.',
    [
      { text: 'Take photo', onPress: () => run('camera') },
      { text: 'Choose from library', onPress: () => run('library') },
      { text: 'Cancel', style: 'cancel' },
    ],
  );
}

/** Map a bodyweight capture result to an alert. Returns true if a weight was saved. */
export function handleBodyweightResult(r: BodyweightCaptureResult): boolean {
  switch (r.status) {
    case 'saved':
      Alert.alert('Bodyweight logged', `${r.kg} kg saved — it'll be in this week's CSV.`);
      return true;
    case 'no-key':
      Alert.alert('API key needed', 'Add your Anthropic API key in Settings → Tracker & API to read weigh-in photos.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => router.push('/settings') },
      ]);
      return false;
    case 'no-permission':
      Alert.alert('Camera permission', 'Camera access is needed to photograph your scale.');
      return false;
    case 'empty':
      Alert.alert('Couldn’t read the weight', 'No bodyweight was detected. Try a clear, straight-on photo of the scale display.');
      return false;
    case 'error':
      Alert.alert('Reading failed', r.message);
      return false;
    case 'cancelled':
    default:
      return false;
  }
}

/** Map a capture result to a user-facing alert. Returns true if an entry was saved. */
export function handleCaptureResult(r: CaptureResult): boolean {
  switch (r.status) {
    case 'saved':
      return true;
    case 'no-key':
      Alert.alert('API key needed', 'Add your Anthropic API key in Settings → Tracker & API to parse photos.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => router.push('/settings') },
      ]);
      return false;
    case 'no-permission':
      Alert.alert('Camera permission', 'Camera access is needed to photograph your tracker page.');
      return false;
    case 'empty':
      Alert.alert('Couldn’t read the page', 'No exercises were detected. Try a clearer, well-lit, straight-on photo.');
      return false;
    case 'error':
      Alert.alert('Parsing failed', r.message);
      return false;
    case 'cancelled':
    default:
      return false;
  }
}

function describeSet(s: TrackerSet): string {
  if (s.durationSeconds) return `${Math.round(s.durationSeconds / 60)}m`;
  const reps = s.reps ?? '–';
  const w = s.weight != null ? ` @ ${s.weight}` : '';
  const flag = s.inferred ? '*' : '';
  return `${reps}${flag}${w}`;
}

export default function TrackerScreen() {
  const entries = useTrackerStore((s) => s.entries);
  const bodyweights = useTrackerStore((s) => s.bodyweights);
  const apiKey = useTrackerStore((s) => s.apiKey);
  const deleteEntry = useTrackerStore((s) => s.deleteEntry);
  const addBodyweight = useTrackerStore((s) => s.addBodyweight);
  const deleteBodyweight = useTrackerStore((s) => s.deleteBodyweight);
  const clearWeeksBefore = useTrackerStore((s) => s.clearWeeksBefore);

  const [busy, setBusy] = useState<null | 'capturing' | 'weighing'>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [weightDraft, setWeightDraft] = useState('');

  const week = currentWeekKey();
  const thisWeek = useMemo(() => entries.filter((e) => e.weekKey === week), [entries, week]);
  const weekBw = useMemo(() => bodyweights.filter((b) => b.weekKey === week), [bodyweights, week]);
  const olderCount = entries.length - thisWeek.length + (bodyweights.length - weekBw.length);

  async function exportCsv(toExport: TrackerEntry[], bw: BodyweightEntry[], label: string) {
    if (toExport.length === 0 && bw.length === 0) {
      Alert.alert('Nothing to export', 'No entries for this period yet.');
      return null;
    }
    const csv = buildWeekCsv(toExport, bw);
    const uri = `${FileSystem.cacheDirectory}workout-${label}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'text/csv', dialogTitle: `Workout tracker — ${label}` });
    } else {
      Alert.alert('Sharing unavailable', `CSV written to:\n${uri}`);
    }
    return uri;
  }

  function handleCapture() {
    promptCaptureSource(async (source) => {
      setBusy('capturing');
      try {
        const result = await runTrackerCapture(source);
        if (handleCaptureResult(result) && result.status === 'saved') {
          setExpandedId(result.entry.id);
        }
      } finally {
        setBusy(null);
      }
    });
  }

  function handleWeighPhoto() {
    promptCaptureSource(
      async (source) => {
        setBusy('weighing');
        try {
          handleBodyweightResult(await runBodyweightCapture(source));
        } finally {
          setBusy(null);
        }
      },
      { title: 'Log bodyweight', message: 'Photograph your scale now, or pick a photo you already took.' },
    );
  }

  async function handleAddWeight() {
    const kg = parseFloat(weightDraft.replace(',', '.'));
    if (!Number.isFinite(kg) || kg <= 0 || kg > 500) {
      Alert.alert('Enter a weight', 'Type your bodyweight in kg, e.g. 82.5');
      return;
    }
    await addBodyweight(kg);
    setWeightDraft('');
  }

  function handleExportOlder() {
    const older = entries.filter((e) => e.weekKey !== week);
    const olderBw = bodyweights.filter((b) => b.weekKey !== week);
    Alert.alert(
      'Export & clear previous weeks?',
      `Export ${older.length + olderBw.length} item(s) from previous weeks to a CSV, then remove them to start fresh?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Export & Clear',
          onPress: async () => {
            const uri = await exportCsv(older, olderBw, 'previous-weeks');
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
              Photo parsing uses the Claude API. Add your key in Settings → Tracker & API to enable capture.
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

        <Text style={styles.sectionLabel}>Bodyweight (Mondays)</Text>
        <View style={styles.card}>
          <View style={styles.bwInputRow}>
            <TextInput
              style={styles.bwInput}
              value={weightDraft}
              onChangeText={setWeightDraft}
              placeholder="e.g. 82.5"
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
              returnKeyType="done"
              onSubmitEditing={handleAddWeight}
            />
            <Text style={styles.bwUnit}>kg</Text>
            <TouchableOpacity style={styles.bwAddBtn} onPress={handleAddWeight} disabled={busy != null}>
              <Text style={styles.bwAddText}>Add</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.bwPhotoBtn}
            onPress={handleWeighPhoto}
            disabled={busy != null}
            activeOpacity={0.8}
          >
            {busy === 'weighing' ? (
              <View style={styles.busyRow}>
                <ActivityIndicator color="#22D46E" />
                <Text style={styles.bwPhotoText}>Reading scale…</Text>
              </View>
            ) : (
              <Text style={styles.bwPhotoText}>📷  Snap the scale instead</Text>
            )}
          </TouchableOpacity>
          {weekBw.length === 0 ? (
            <Text style={styles.bwHint}>Log your post-gym weigh-in. It's included in the weekly CSV.</Text>
          ) : (
            weekBw.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={styles.bwRow}
                onLongPress={() =>
                  Alert.alert('Delete weigh-in?', `${b.kg} kg on ${b.date.slice(0, 10)}`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteBodyweight(b.id) },
                  ])
                }
              >
                <Text style={styles.bwDate}>{b.date.slice(0, 10)}</Text>
                <Text style={styles.bwKg}>{b.kg} kg</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <Text style={styles.sectionLabel}>This week · {week}</Text>

        {thisWeek.length === 0 && (
          <Text style={styles.empty}>No pages logged yet this week. Tap “Capture page” below.</Text>
        )}

        {thisWeek.map((entry) => {
          const expanded = expandedId === entry.id;
          const setCount = entry.exercises.reduce((n, e) => n + e.sets.length, 0);
          const sub = [entry.weekNumber ? `Week ${entry.weekNumber}` : null, entry.weekDate]
            .filter(Boolean)
            .join(' · ');
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
                    {entry.capturedAt.slice(0, 10)}{sub ? ` · ${sub}` : ''} · {entry.exercises.length} exercises · {setCount} sets
                  </Text>
                </View>
                <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
              </TouchableOpacity>

              {expanded && (
                <View style={styles.cardBody}>
                  {entry.exercises.map((ex, i) => (
                    <View key={i} style={styles.exRow}>
                      <Text style={styles.exName}>
                        {ex.name}
                        {ex.target ? <Text style={styles.exTarget}>  ({ex.target})</Text> : null}
                      </Text>
                      <Text style={styles.exSets}>{ex.sets.map(describeSet).join('   ')}</Text>
                    </View>
                  ))}
                  {entry.notes ? <Text style={styles.entryNotes}>Notes: {entry.notes}</Text> : null}
                  <Text style={styles.legend}>* reps inferred from target (bare weight written)</Text>
                  <TouchableOpacity onPress={() => confirmDelete(entry.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>Delete entry</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}

        {(thisWeek.length > 0 || weekBw.length > 0) && (
          <TouchableOpacity style={styles.exportBtn} onPress={() => exportCsv(thisWeek, weekBw, week)} activeOpacity={0.8}>
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
          {busy === 'capturing' ? (
            <View style={styles.busyRow}>
              <ActivityIndicator color="#000" />
              <Text style={styles.captureText}>Reading page…</Text>
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

  bwInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  bwInput: {
    flex: 1, height: 44, borderRadius: 8, paddingHorizontal: 12,
    backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: '#2A2A2A',
    color: '#F0F0F0', fontSize: 16, fontVariant: ['tabular-nums'],
  },
  bwUnit: { fontSize: 15, color: '#888', fontWeight: '600' },
  bwAddBtn: { height: 44, paddingHorizontal: 18, borderRadius: 8, backgroundColor: '#22D46E', alignItems: 'center', justifyContent: 'center' },
  bwAddText: { color: '#000', fontWeight: '800', fontSize: 14 },
  bwPhotoBtn: {
    marginHorizontal: 16, marginBottom: 4, height: 44, borderRadius: 8,
    borderWidth: 1.5, borderColor: 'rgba(34,212,110,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  bwPhotoText: { color: '#22D46E', fontWeight: '700', fontSize: 14 },
  bwHint: { fontSize: 12, color: '#888', paddingHorizontal: 16, paddingBottom: 14, lineHeight: 18 },
  bwRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#1A1A1A',
  },
  bwDate: { fontSize: 13, color: '#888' },
  bwKg: { fontSize: 15, color: '#F0F0F0', fontWeight: '700', fontVariant: ['tabular-nums'] },

  card: { backgroundColor: '#111', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#F0F0F0' },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 4 },
  chevron: { fontSize: 16, color: '#888' },
  cardBody: { paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#1A1A1A', paddingTop: 8 },
  exRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  exName: { fontSize: 14, fontWeight: '500', color: '#F0F0F0' },
  exTarget: { fontSize: 12, color: '#666', fontWeight: '400' },
  exSets: { fontSize: 13, color: '#888', marginTop: 3, fontVariant: ['tabular-nums'] },
  entryNotes: { fontSize: 12, color: '#888', marginTop: 10, lineHeight: 18, fontStyle: 'italic' },
  legend: { fontSize: 11, color: '#555', marginTop: 8 },
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
