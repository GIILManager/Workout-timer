import { TrackerEntry } from '../types';

function esc(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Flatten a week's tracker entries into one CSV row per set. */
export function buildWeekCsv(entries: TrackerEntry[]): string {
  const header = ['week', 'date', 'title', 'exercise', 'set', 'reps', 'weight', 'notes'];
  const rows: string[] = [header.join(',')];
  for (const entry of entries) {
    const date = entry.capturedAt.slice(0, 10);
    for (const ex of entry.exercises) {
      ex.sets.forEach((s, i) => {
        rows.push(
          [
            esc(entry.weekKey),
            esc(date),
            esc(entry.title ?? ''),
            esc(ex.name),
            esc(i + 1),
            esc(s.reps),
            esc(s.weight),
            esc(s.notes ?? ''),
          ].join(','),
        );
      });
    }
  }
  return rows.join('\n');
}
