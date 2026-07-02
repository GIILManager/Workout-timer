import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import * as Crypto from 'expo-crypto';
import { BodyweightEntry, TrackerEntry } from '../types';
import { weekKey } from '../utils/week';

export const TRACKER_KEYS = {
  entries: 'tracker_entries',
  bodyweight: 'tracker_bodyweight',
  apiKey: 'claude_api_key',
  lastExport: 'tracker_last_export',
} as const;
const KEYS = TRACKER_KEYS;

interface TrackerState {
  entries: TrackerEntry[];
  bodyweights: BodyweightEntry[];
  apiKey: string;
  /** ISO week key of the most recent export — silences that week's reminder. */
  lastExportWeekKey: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  addEntry: (entry: TrackerEntry) => Promise<void>;
  updateEntry: (id: string, patch: Partial<TrackerEntry>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  addBodyweight: (kg: number, date?: Date) => Promise<void>;
  deleteBodyweight: (id: string) => Promise<void>;
  markExported: (week: string) => Promise<void>;
  /** Drop every entry AND bodyweight whose weekKey is not the current week. */
  clearWeeksBefore: (currentWeek: string) => Promise<void>;
}

export const useTrackerStore = create<TrackerState>((set, get) => ({
  entries: [],
  bodyweights: [],
  apiKey: '',
  lastExportWeekKey: null,
  hydrated: false,

  async hydrate() {
    try {
      const [rawEntries, rawBw, rawKey, rawExport] = await Promise.all([
        AsyncStorage.getItem(KEYS.entries),
        AsyncStorage.getItem(KEYS.bodyweight),
        AsyncStorage.getItem(KEYS.apiKey),
        AsyncStorage.getItem(KEYS.lastExport),
      ]);
      set({
        entries: rawEntries ? JSON.parse(rawEntries) : [],
        bodyweights: rawBw ? JSON.parse(rawBw) : [],
        apiKey: rawKey ?? '',
        lastExportWeekKey: rawExport,
        hydrated: true,
      });
    } catch {
      set({ hydrated: true });
    }
  },

  async setApiKey(key) {
    const trimmed = key.trim();
    set({ apiKey: trimmed });
    await AsyncStorage.setItem(KEYS.apiKey, trimmed);
  },

  async addEntry(entry) {
    const next = [entry, ...get().entries];
    set({ entries: next });
    await AsyncStorage.setItem(KEYS.entries, JSON.stringify(next));
  },

  async updateEntry(id, patch) {
    const next = get().entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    set({ entries: next });
    await AsyncStorage.setItem(KEYS.entries, JSON.stringify(next));
  },

  async deleteEntry(id) {
    const next = get().entries.filter((e) => e.id !== id);
    set({ entries: next });
    await AsyncStorage.setItem(KEYS.entries, JSON.stringify(next));
  },

  async addBodyweight(kg, date = new Date()) {
    const entry: BodyweightEntry = {
      id: Crypto.randomUUID(),
      date: date.toISOString(),
      weekKey: weekKey(date),
      kg,
    };
    const next = [entry, ...get().bodyweights];
    set({ bodyweights: next });
    await AsyncStorage.setItem(KEYS.bodyweight, JSON.stringify(next));
  },

  async deleteBodyweight(id) {
    const next = get().bodyweights.filter((b) => b.id !== id);
    set({ bodyweights: next });
    await AsyncStorage.setItem(KEYS.bodyweight, JSON.stringify(next));
  },

  async markExported(week) {
    set({ lastExportWeekKey: week });
    await AsyncStorage.setItem(KEYS.lastExport, week);
  },

  async clearWeeksBefore(currentWeek) {
    const entries = get().entries.filter((e) => e.weekKey === currentWeek);
    const bodyweights = get().bodyweights.filter((b) => b.weekKey === currentWeek);
    set({ entries, bodyweights });
    await AsyncStorage.multiSet([
      [KEYS.entries, JSON.stringify(entries)],
      [KEYS.bodyweight, JSON.stringify(bodyweights)],
    ]);
  },
}));

export function currentWeekKey(): string {
  return weekKey();
}
