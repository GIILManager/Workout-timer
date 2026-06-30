export type ExerciseType = 'TIER1' | 'STANDARD' | 'AMRAP' | 'TIMED' | 'CARDIO';

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  sets: number;
  reps: string;
}

export interface WorkoutDay {
  day: 'monday' | 'tuesday' | 'thursday' | 'friday';
  dayOfWeek: number;
  name: string;
  muscleGroups: string;
  exercises: Exercise[];
}

export interface TimingRecord {
  exerciseId: string;
  setNumber: number;
  setDuration: number | null;
  breakDuration: number | null;
  date: string;
  sessionId: string;
  /** True for between-exercise transition (setup/bathroom) records.
   *  exerciseId on these is the UPCOMING exercise being set up for. */
  transition?: boolean;
}

export interface SetRecord {
  exerciseId: string;
  exerciseName: string;
  setNumber: number;
  predictedSetDuration: number | null;
  actualSetDuration: number | null;
  predictedBreakDuration: number | null;
  actualBreakDuration: number;
  completedAt: string;
}

export interface WorkoutSession {
  id: string;
  day: string;
  date: string;
  totalDuration: number;
  exercisesCompleted: number;
  setRecords: SetRecord[];
  notes?: string;
}

export interface UserSettings {
  tier1SetDuration: number;
  tier1BreakDuration: number;
  standardSetDuration: number;
  standardBreakDuration: number;
  transitionDuration: number;
  targetWorkoutMinutes: number;
  warningWorkoutMinutes: number;
  minSessionsForAdaptation: number;
}

// ── Workout tracker (handwritten-page photo logging) ──────────────────────

export interface TrackerSet {
  setNumber: number;        // 1-based (S1, S2, …)
  reps: number | null;      // actual reps performed
  weight: number | null;    // kg as written (unit stripped); null for bodyweight/timed
  durationSeconds?: number | null; // for timed holds (e.g. plank "1m")
  inferred?: boolean;       // true when reps were inferred from the target (bare-weight rule)
  raw?: string;             // exactly what was written in the box
  notes?: string;
}

export interface TrackerExercise {
  name: string;
  target?: string;          // the "Sets × Reps" target, e.g. "4×8-10", "3×Failure"
  sets: TrackerSet[];
}

export interface TrackerEntry {
  id: string;
  capturedAt: string;       // ISO
  weekKey: string;          // ISO week the photo was taken, e.g. "2026-W27"
  month?: string;           // month printed/written on the page, e.g. "July"
  day?: string;             // day heading, e.g. "Monday — Chest, Biceps & Abs"
  weekNumber?: number | null;   // which WEEK column (1-4) was read
  weekDate?: string;        // date written above that column, e.g. "25th"
  title?: string;           // short label for the entry
  exercises: TrackerExercise[];
  notes?: string;           // page notes / PRs / form cues
  rawText?: string;         // model's free-text transcription, for reference
}

export type TimerPhase = 'set' | 'break' | 'amrap' | 'timed' | 'transition' | 'idle';

export interface AdaptedTiming {
  setDuration: number | null;
  breakDuration: number;
}
