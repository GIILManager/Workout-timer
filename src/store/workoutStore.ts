import { create } from 'zustand';
import { Exercise, SetRecord, TimerPhase, WorkoutDay } from '../types';

interface WorkoutState {
  activeWorkout: WorkoutDay | null;
  sessionId: string | null;
  sessionStartedAt: number | null;
  currentExerciseIndex: number;
  currentSetNumber: number;
  currentPhase: TimerPhase;
  phaseStartedAt: number | null;
  targetDuration: number | null;
  setRecords: SetRecord[];
  warningDismissed: boolean;
  pendingSetRecord: Partial<SetRecord> | null;

  startWorkout: (workout: WorkoutDay, sessionId: string) => void;
  startSet: (targetDuration: number | null) => void;
  startBreak: (targetDuration: number) => void;
  completeBreak: (actualBreakDuration: number) => void;
  skipBreak: () => void;
  addSetRecord: (record: SetRecord) => void;
  setPendingSetRecord: (record: Partial<SetRecord>) => void;
  advanceToNextExercise: () => boolean;
  abandonWorkout: () => void;
  dismissWarning: () => void;
  reset: () => void;
}

const initialState = {
  activeWorkout: null,
  sessionId: null,
  sessionStartedAt: null,
  currentExerciseIndex: 0,
  currentSetNumber: 1,
  currentPhase: 'idle' as TimerPhase,
  phaseStartedAt: null,
  targetDuration: null,
  setRecords: [],
  warningDismissed: false,
  pendingSetRecord: null,
};

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  ...initialState,

  startWorkout(workout, sessionId) {
    set({
      activeWorkout: workout,
      sessionId,
      sessionStartedAt: Date.now(),
      currentExerciseIndex: 0,
      currentSetNumber: 1,
      currentPhase: 'idle',
      phaseStartedAt: null,
      targetDuration: null,
      setRecords: [],
      warningDismissed: false,
      pendingSetRecord: null,
    });
  },

  startSet(targetDuration) {
    const { activeWorkout, currentExerciseIndex } = get();
    const ex = activeWorkout?.exercises[currentExerciseIndex];
    const phase: TimerPhase = ex?.type === 'AMRAP' ? 'amrap' : ex?.type === 'TIMED' ? 'timed' : 'set';
    set({ currentPhase: phase, phaseStartedAt: Date.now(), targetDuration });
  },

  startBreak(targetDuration) {
    set({ currentPhase: 'break', phaseStartedAt: Date.now(), targetDuration });
  },

  completeBreak(_actualBreakDuration) {
    const { activeWorkout, currentExerciseIndex, currentSetNumber } = get();
    const ex = activeWorkout?.exercises[currentExerciseIndex];
    if (!ex) return;
    if (currentSetNumber < ex.sets) {
      set({ currentSetNumber: currentSetNumber + 1, currentPhase: 'idle' });
    }
  },

  skipBreak() {
    get().completeBreak(0);
  },

  addSetRecord(record) {
    set((s) => ({ setRecords: [...s.setRecords, record] }));
  },

  setPendingSetRecord(record) {
    set({ pendingSetRecord: record });
  },

  advanceToNextExercise() {
    const { activeWorkout, currentExerciseIndex } = get();
    if (!activeWorkout) return false;
    let next = currentExerciseIndex + 1;
    while (next < activeWorkout.exercises.length && activeWorkout.exercises[next].type === 'CARDIO') {
      next++;
    }
    if (next >= activeWorkout.exercises.length) return false;
    set({ currentExerciseIndex: next, currentSetNumber: 1, currentPhase: 'idle' });
    return true;
  },

  abandonWorkout() {
    set({ ...initialState, currentPhase: 'idle' });
  },

  dismissWarning() {
    set({ warningDismissed: true });
  },

  reset() {
    set({ ...initialState, currentPhase: 'idle' });
  },
}));

export function getCurrentExercise(): Exercise | null {
  const { activeWorkout, currentExerciseIndex } = useWorkoutStore.getState();
  return activeWorkout?.exercises[currentExerciseIndex] ?? null;
}
