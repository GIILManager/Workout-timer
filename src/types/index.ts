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
  breakDuration: number;
  date: string;
  sessionId: string;
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
  targetWorkoutMinutes: number;
  warningWorkoutMinutes: number;
  minSessionsForAdaptation: number;
}

export type TimerPhase = 'set' | 'break' | 'amrap' | 'timed' | 'idle';

export interface AdaptedTiming {
  setDuration: number | null;
  breakDuration: number;
}
