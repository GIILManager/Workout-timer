import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { TrackerEntry } from '../types';
import { weekKey } from '../utils/week';

const KEYS = {
  entries: 'tracker_entries',
  apiKey: 'claude_api_key',
} as const;

interface TrackerState {
  entries: TrackerEntry[];
  apiKey: string;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  setApiKey: (key: string) => Promise<void>;
  addEntry: (entry: TrackerEntry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  /** Remove every entry whose weekKey is not the current week (post-export reset). */
  clearWeeksBefore: (currentWeek: string) => Promise<void>;
}

export const useTrackerStore = create<TrackerState>((set, get) => ({
  entries: [],
  apiKey: '',
  hydrated: false,

  async hydrate() {
    try {
      const [rawEntries, rawKey] = await Promise.all([
        AsyncStorage.getItem(KEYS.entries),
        AsyncStorage.getItem(KEYS.apiKey),
      ]);
      set({
        entries: rawEntries ? JSON.parse(rawEntries) : [],
        apiKey: rawKey ?? '',
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

  async deleteEntry(id) {
    const next = get().entries.filter((e) => e.id !== id);
    set({ entries: next });
    await AsyncStorage.setItem(KEYS.entries, JSON.stringify(next));
  },

  async clearWeeksBefore(currentWeek) {
    const next = get().entries.filter((e) => e.weekKey === currentWeek);
    set({ entries: next });
    await AsyncStorage.setItem(KEYS.entries, JSON.stringify(next));
  },
}));

export function currentWeekKey(): string {
  return weekKey();
}
