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
  reps: number | null;
  weight: number | null; // in the unit the user wrote (kg/lb); not normalised
  notes?: string;
}

export interface TrackerExercise {
  name: string;
  sets: TrackerSet[];
}

export interface TrackerEntry {
  id: string;
  capturedAt: string; // ISO
  weekKey: string;    // e.g. "2026-W27"
  title?: string;     // e.g. "Monday — Chest" if legible
  exercises: TrackerExercise[];
  rawText?: string;   // model's free-text transcription, for reference
}

export type TimerPhase = 'set' | 'break' | 'amrap' | 'timed' | 'transition' | 'idle';

export interface AdaptedTiming {
  setDuration: number | null;
  breakDuration: number;
}
