import { create } from 'zustand';
import { Exercise, SetRecord, TimerPhase, WorkoutDay } from '../types';
import { cancelAlert, scheduleAlert } from '../utils/notificationService';

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
  pendingAlertId: string | null;

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
  pendingAlertId: null,
};

async function replaceAlert(
  currentId: string | null,
  seconds: number | null,
  title: string,
  body: string,
): Promise<string | null> {
  await cancelAlert(currentId);
  if (seconds == null || seconds <= 0) return null;
  return scheduleAlert(seconds, title, body);
}

export const useWorkoutStore = create<WorkoutState>((set, get) => ({
  ...initialState,

  startWorkout(workout, sessionId) {
    cancelAlert(get().pendingAlertId);
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
      pendingAlertId: null,
    });
  },

  startSet(targetDuration) {
    const { activeWorkout, currentExerciseIndex, pendingAlertId, currentSetNumber } = get();
    const ex = activeWorkout?.exercises[currentExerciseIndex];
    const phase: TimerPhase = ex?.type === 'AMRAP' ? 'amrap' : ex?.type === 'TIMED' ? 'timed' : 'set';
    set({ currentPhase: phase, phaseStartedAt: Date.now(), targetDuration });
    if (phase !== 'amrap' && targetDuration && ex) {
      replaceAlert(
        pendingAlertId,
        targetDuration,
        'Set complete',
        `${ex.name} · set ${currentSetNumber} done — tap DONE`,
      ).then((id) => set({ pendingAlertId: id }));
    } else {
      replaceAlert(pendingAlertId, null, '', '').then((id) => set({ pendingAlertId: id }));
    }
  },

  startBreak(targetDuration) {
    const { pendingAlertId, activeWorkout, currentExerciseIndex, currentSetNumber } = get();
    const ex = activeWorkout?.exercises[currentExerciseIndex];
    const isLastSet = !!ex && currentSetNumber >= ex.sets;
    const nextLabel = !ex
      ? ''
      : isLastSet
        ? 'next exercise ready'
        : `set ${currentSetNumber + 1} ready`;
    set({ currentPhase: 'break', phaseStartedAt: Date.now(), targetDuration });
    replaceAlert(
      pendingAlertId,
      targetDuration,
      'Break over',
      ex ? `${ex.name} · ${nextLabel}` : 'Ready for next set',
    ).then((id) => set({ pendingAlertId: id }));
  },

  completeBreak(_actualBreakDuration) {
    const { activeWorkout, currentExerciseIndex, currentSetNumber, pendingAlertId } = get();
    cancelAlert(pendingAlertId);
    const ex = activeWorkout?.exercises[currentExerciseIndex];
    if (!ex) return;
    if (currentSetNumber < ex.sets) {
      set({ currentSetNumber: currentSetNumber + 1, currentPhase: 'idle', pendingAlertId: null });
    } else {
      set({ pendingAlertId: null });
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
    const { activeWorkout, currentExerciseIndex, pendingAlertId } = get();
    if (!activeWorkout) return false;
    let next = currentExerciseIndex + 1;
    while (next < activeWorkout.exercises.length && activeWorkout.exercises[next].type === 'CARDIO') {
      next++;
    }
    if (next >= activeWorkout.exercises.length) return false;
    cancelAlert(pendingAlertId);
    set({ currentExerciseIndex: next, currentSetNumber: 1, currentPhase: 'idle', pendingAlertId: null });
    return true;
  },

  abandonWorkout() {
    cancelAlert(get().pendingAlertId);
    set({ ...initialState, currentPhase: 'idle' });
  },

  dismissWarning() {
    set({ warningDismissed: true });
  },

  reset() {
    cancelAlert(get().pendingAlertId);
    set({ ...initialState, currentPhase: 'idle' });
  },
}));

export function getCurrentExercise(): Exercise | null {
  const { activeWorkout, currentExerciseIndex } = useWorkoutStore.getState();
  return activeWorkout?.exercises[currentExerciseIndex] ?? null;
}
