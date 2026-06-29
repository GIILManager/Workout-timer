import { AdaptedTiming, Exercise, ExerciseType, TimingRecord, UserSettings, WorkoutDay } from '../types';

export const DEFAULT_SETTINGS: UserSettings = {
  tier1SetDuration: 60,
  tier1BreakDuration: 150,
  standardSetDuration: 40,
  standardBreakDuration: 90,
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
  const records = allRecords.filter((r) => r.exerciseId === exerciseId);
  if (records.length < settings.minSessionsForAdaptation) {
    return getDefaultTiming(exerciseType, settings);
  }
  const last15 = records.slice(-15);
  const setDurations = last15.map((r) => r.setDuration).filter((d): d is number => d !== null);
  const breakDurations = last15.map((r) => r.breakDuration);
  const avgSet = setDurations.length > 0 ? setDurations.reduce((a, b) => a + b, 0) / setDurations.length : null;
  const avgBreak = breakDurations.reduce((a, b) => a + b, 0) / breakDurations.length;
  return {
    setDuration: exerciseType === 'AMRAP' ? null : (avgSet !== null ? Math.round(avgSet) : getDefaultTiming(exerciseType, settings).setDuration),
    breakDuration: Math.max(30, Math.round(avgBreak)),
  };
}

export function estimateTotalDuration(
  workout: WorkoutDay,
  allRecords: TimingRecord[],
  settings: UserSettings,
): number {
  let total = 0;
  for (const ex of workout.exercises) {
    if (ex.type === 'CARDIO') continue;
    const timing = getAdaptedTiming(ex.id, ex.type, allRecords, settings);
    const setDur = ex.type === 'AMRAP' ? 45 : (timing.setDuration ?? 45);
    total += ex.sets * setDur + (ex.sets - 1) * timing.breakDuration;
  }
  return total;
}
