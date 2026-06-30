import { TrackerEntry } from '../types';

function esc(v: string | number | boolean | null | undefined): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Flatten tracker entries into one CSV row per set. */
export function buildWeekCsv(entries: TrackerEntry[]): string {
  const header = [
    'captured', 'month', 'day', 'page_week', 'week_date',
    'exercise', 'target', 'set', 'reps', 'weight', 'duration_s', 'inferred', 'raw', 'notes',
  ];
  const rows: string[] = [header.join(',')];
  for (const entry of entries) {
    const captured = entry.capturedAt.slice(0, 10);
    for (const ex of entry.exercises) {
      ex.sets.forEach((s) => {
        rows.push(
          [
            esc(captured),
            esc(entry.month ?? ''),
            esc(entry.day ?? ''),
            esc(entry.weekNumber ?? ''),
            esc(entry.weekDate ?? ''),
            esc(ex.name),
            esc(ex.target ?? ''),
            esc(s.setNumber),
            esc(s.reps),
            esc(s.weight),
            esc(s.durationSeconds ?? ''),
            esc(s.inferred ? 'yes' : ''),
            esc(s.raw ?? ''),
            esc(s.notes ?? ''),
          ].join(','),
        );
      });
    }
  }
  return rows.join('\n');
}
