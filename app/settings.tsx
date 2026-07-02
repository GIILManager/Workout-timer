import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { ChevronLeftIcon, TrashIcon } from '../src/components/icons';
import { useHistoryStore } from '../src/store/historyStore';
import { useTrackerStore } from '../src/store/trackerStore';
import { UserSettings } from '../src/types';

interface SliderConfig {
  key: keyof UserSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

const SLIDER_CONFIGS: SliderConfig[] = [
  { key: 'tier1SetDuration',     label: 'T1 Set Duration',  min: 30,  max: 90,  step: 5, format: (v) => `${v}s` },
  { key: 'tier1BreakDuration',   label: 'T1 Rest Period',   min: 90,  max: 240, step: 5, format: (v) => `${Math.floor(v/60)}:${(v%60).toString().padStart(2,'0')}` },
  { key: 'standardSetDuration',  label: 'Standard Set',     min: 20,  max: 60,  step: 5, format: (v) => `${v}s` },
  { key: 'standardBreakDuration',label: 'Standard Rest',    min: 60,  max: 150, step: 5, format: (v) => `${Math.floor(v/60)}:${(v%60).toString().padStart(2,'0')}` },
  { key: 'transitionDuration',   label: 'Exercise Transition', min: 60, max: 300, step: 15, format: (v) => `${Math.floor(v/60)}:${(v%60).toString().padStart(2,'0')}` },
];

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: number }[];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={sc.container}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[sc.segment, opt.value === value && sc.segmentActive]}
          onPress={() => onChange(opt.value)}
          activeOpacity={0.7}
        >
          <Text style={[sc.segmentText, opt.value === value && sc.segmentTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const sc = StyleSheet.create({
  container: { flexDirection: 'row', height: 40, borderRadius: 8, overflow: 'hidden' },
  segment: { flex: 1, backgroundColor: '#1C1C1C', alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: '#22D46E' },
  segmentText: { fontSize: 13, color: '#888' },
  segmentTextActive: { color: '#000', fontWeight: '700' },
});

function ApiKeyField() {
  const apiKey = useTrackerStore((s) => s.apiKey);
  const setApiKey = useTrackerStore((s) => s.setApiKey);
  const [draft, setDraft] = useState(apiKey);
  const [editing, setEditing] = useState(false);

  const masked = apiKey ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}` : 'Not set';

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Anthropic API Key</Text>
      {editing ? (
        <>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="sk-ant-…"
            placeholderTextColor="#555"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <View style={styles.keyBtnRow}>
            <TouchableOpacity
              style={[styles.keyBtn, styles.keyBtnPrimary]}
              onPress={async () => { await setApiKey(draft); setEditing(false); }}
            >
              <Text style={styles.keyBtnPrimaryText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.keyBtn} onPress={() => { setDraft(apiKey); setEditing(false); }}>
              <Text style={styles.keyBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.keyRow}>
          <Text style={styles.keyValue}>{masked}</Text>
          <TouchableOpacity onPress={() => { setDraft(apiKey); setEditing(true); }}>
            <Text style={styles.keyEdit}>{apiKey ? 'Change' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.hint}>
        Used only on this device to parse photos of your handwritten tracker via Claude. Stored locally, never shared.
      </Text>
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, updateSettings, resetLearning } = useHistoryStore();

  function handleResetLearning() {
    Alert.alert(
      'Reset Learned Timings?',
      'This will clear all adapted times. Your session history will be kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: () => resetLearning() },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeftIcon size={24} color="#888" />
        </TouchableOpacity>
        <Text style={styles.title}>SETTINGS</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <Text style={styles.sectionLabel}>Timer Defaults</Text>

        {SLIDER_CONFIGS.map((cfg) => {
          const rawValue = settings[cfg.key] as number;
          return (
            <View key={cfg.key} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardLabel}>{cfg.label}</Text>
                <Text style={styles.cardValue}>{cfg.format(rawValue)}</Text>
              </View>
              <Slider
                style={{ marginTop: 8, height: 30 }}
                minimumValue={cfg.min}
                maximumValue={cfg.max}
                step={cfg.step}
                value={rawValue}
                minimumTrackTintColor="#22D46E"
                maximumTrackTintColor="#262626"
                thumbTintColor="#22D46E"
                onSlidingComplete={(v) => updateSettings({ [cfg.key]: v })}
              />
            </View>
          );
        })}

        <Text style={styles.sectionLabel}>Workout Duration</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Workout Target</Text>
          <View style={{ marginTop: 12 }}>
            <SegmentedControl
              options={[{ label: '60 min', value: 60 }, { label: '75 min', value: 75 }, { label: '90 min', value: 90 }]}
              value={settings.targetWorkoutMinutes}
              onChange={(v) => updateSettings({ targetWorkoutMinutes: v })}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Overtime Warning</Text>
          <View style={{ marginTop: 12 }}>
            <SegmentedControl
              options={[{ label: '90 min', value: 90 }, { label: '105 min', value: 105 }, { label: '120 min', value: 120 }]}
              value={settings.warningWorkoutMinutes}
              onChange={(v) => updateSettings({ warningWorkoutMinutes: v })}
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>Tracker & API</Text>

        <ApiKeyField />

        <Text style={styles.sectionLabel}>Learning</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Min Sessions to Adapt</Text>
          <View style={{ marginTop: 12 }}>
            <SegmentedControl
              options={[{ label: '2', value: 2 }, { label: '3', value: 3 }, { label: '5', value: 5 }]}
              value={settings.minSessionsForAdaptation}
              onChange={(v) => updateSettings({ minSessionsForAdaptation: v })}
            />
          </View>
          <Text style={styles.hint}>
            After this many sessions per exercise, the app adapts break times to match your actual pace.
          </Text>
        </View>

        <TouchableOpacity style={styles.destructiveCard} onPress={handleResetLearning} activeOpacity={0.7}>
          <View style={styles.destructiveRow}>
            <TrashIcon size={17} color="#EF4444" />
            <Text style={styles.destructiveLabel}>Reset Learned Timings</Text>
          </View>
          <Text style={styles.destructiveHint}>Resets adapted times. Sessions history kept.</Text>
        </TouchableOpacity>

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
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#F0F0F0' },

  content: { paddingHorizontal: 24, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: '#888', textTransform: 'uppercase',
    letterSpacing: 1.5, marginTop: 24, marginBottom: 12,
  },
  card: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12,
    padding: 16, marginBottom: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { fontSize: 15, fontWeight: '500', color: '#F0F0F0' },
  cardValue: { fontSize: 15, fontWeight: '700', color: '#22D46E' },
  hint: { fontSize: 12, lineHeight: 18, color: '#888', marginTop: 10 },

  input: {
    marginTop: 12, height: 44, borderRadius: 8, paddingHorizontal: 12,
    backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: '#2A2A2A',
    color: '#F0F0F0', fontSize: 14,
  },
  keyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  keyValue: { fontSize: 14, color: '#F0F0F0', fontVariant: ['tabular-nums'] },
  keyEdit: { fontSize: 14, fontWeight: '700', color: '#22D46E' },
  keyBtnRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  keyBtn: { flex: 1, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2A2A2A' },
  keyBtnPrimary: { backgroundColor: '#22D46E', borderColor: '#22D46E' },
  keyBtnPrimaryText: { color: '#000', fontWeight: '800', fontSize: 14 },
  keyBtnText: { color: '#888', fontWeight: '600', fontSize: 14 },

  destructiveCard: {
    backgroundColor: '#111', borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 12,
    padding: 16, marginBottom: 8,
  },
  destructiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  destructiveLabel: { fontSize: 15, fontWeight: '500', color: '#EF4444' },
  destructiveHint: { fontSize: 12, color: '#888', marginTop: 6 },
});
