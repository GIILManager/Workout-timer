import { AdaptedTiming, Exercise, ExerciseType, TimingRecord, UserSettings, WorkoutDay } from '../types';

export const DEFAULT_SETTINGS: UserSettings = {
  tier1SetDuration: 60,
  tier1BreakDuration: 150,
  standardSetDuration: 40,
  standardBreakDuration: 90,
  transitionDuration: 180,
  targetWorkoutMinutes: 90,
  warningWorkoutMinutes: 120,
  minSessionsForAdaptation: 3,
};

const TYPE_DEFAULTS: Record<ExerciseType, AdaptedTiming> = {
  TIER1:    { setDuration: 60,   breakDuration: 150 },
  STANDARD: { setDuration: 40,   breakDuration: 90  },
  AMRAP:    { setDuration: null, breakDuration: 90  },
  TIMED:    { setDuration: 60,   breakDuration: 60  },
  CARDIO:   { setDuration: null, breakDuration: 0   },
};

export function getDefaultTiming(type: ExerciseType, settings: UserSettings): AdaptedTiming {
  switch (type) {
    case 'TIER1':    return { setDuration: settings.tier1SetDuration,    breakDuration: settings.tier1BreakDuration };
    case 'STANDARD': return { setDuration: settings.standardSetDuration, breakDuration: settings.standardBreakDuration };
    case 'AMRAP':    return { setDuration: null, breakDuration: settings.standardBreakDuration };
    case 'TIMED':    return { setDuration: 60,   breakDuration: 60 };
    case 'CARDIO':   return { setDuration: null, breakDuration: 0 };
  }
}

export function getAdaptedTiming(
  exerciseId: string,
  exerciseType: ExerciseType,
  allRecords: TimingRecord[],
  settings: UserSettings,
): AdaptedTiming {
  const records = allRecords.filter((r) => r.exerciseId === exerciseId && !r.transition);
  if (records.length < settings.minSessionsForAdaptation) {
    return getDefaultTiming(exerciseType, settings);
  }
  const last15 = records.slice(-15);
  const setDurations = last15.map((r) => r.setDuration).filter((d): d is number => d !== null);
  const breakDurations = last15.map((r) => r.breakDuration).filter((d): d is number => d !== null);
  const avgSet = setDurations.length > 0 ? setDurations.reduce((a, b) => a + b, 0) / setDurations.length : null;
  const defaults = getDefaultTiming(exerciseType, settings);
  const avgBreak = breakDurations.length > 0
    ? breakDurations.reduce((a, b) => a + b, 0) / breakDurations.length
    : null;
  return {
    setDuration: exerciseType === 'AMRAP' ? null : (avgSet !== null ? Math.round(avgSet) : defaults.setDuration),
    breakDuration: avgBreak !== null ? Math.max(30, Math.round(avgBreak)) : defaults.breakDuration,
  };
}

/**
 * Adaptive countdown for the between-exercise transition (weight setup / bathroom).
 * Keyed by the UPCOMING exercise id, since setup time is a property of the exercise
 * you're about to start. Falls back to the user's transition default until enough
 * history exists.
 */
export function getAdaptedTransition(
  nextExerciseId: string,
  allRecords: TimingRecord[],
  settings: UserSettings,
): number {
  const records = allRecords.filter(
    (r) => r.exerciseId === nextExerciseId && r.transition && r.breakDuration !== null,
  );
  if (records.length < settings.minSessionsForAdaptation) {
    return settings.transitionDuration;
  }
  const last15 = records.slice(-15);
  const avg = last15.reduce((a, r) => a + (r.breakDuration ?? 0), 0) / last15.length;
  return Math.max(30, Math.round(avg));
}

export function estimateTotalDuration(
  workout: WorkoutDay,
  allRecords: TimingRecord[],
  settings: UserSettings,
): number {
  let total = 0;
  let seenFirst = false;
  for (const ex of workout.exercises) {
    if (ex.type === 'CARDIO') continue;
    const timing = getAdaptedTiming(ex.id, ex.type, allRecords, settings);
    const setDur = ex.type === 'AMRAP' ? 45 : (timing.setDuration ?? 45);
    // transition (setup) before every exercise except the first
    if (seenFirst) total += getAdaptedTransition(ex.id, allRecords, settings);
    total += ex.sets * setDur + (ex.sets - 1) * timing.breakDuration;
    seenFirst = true;
  }
  return total;
}
