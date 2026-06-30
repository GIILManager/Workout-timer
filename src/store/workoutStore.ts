import { create } from 'zustand';
import { Exercise, SetRecord, TimerPhase, WorkoutDay } from '../types';
import {
  cancelAlert,
  dismissOngoing,
  presentOngoing,
  scheduleAlert,
} from '../utils/notificationService';

interface WorkoutState {
  activeWorkout: WorkoutDay | null;
  sessionId: string | null;
  sessionStartedAt: number | null;
  currentExerciseIndex: number;
  currentSetNumber: number;
  currentPhase: TimerPhase;
  phaseStartedAt: number | null;
  targetDuration: number | null;
  pausedAt: number | null;
  setRecords: SetRecord[];
  warningDismissed: boolean;
  pendingSetRecord: Partial<SetRecord> | null;
  pendingAlertId: string | null;
  ongoingId: string | null;

  startWorkout: (workout: WorkoutDay, sessionId: string) => void;
  startSet: (targetDuration: number | null) => void;
  startBreak: (targetDuration: number) => void;
  startTransition: (targetDuration: number) => void;
  completeBreak: (actualBreakDuration: number) => void;
  skipBreak: () => void;
  pause: () => void;
  resume: () => void;
  addSetRecord: (record: SetRecord) => void;
  patchLastBreak: (actualBreakDuration: number) => void;
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
  pausedAt: null,
  setRecords: [],
  warningDismissed: false,
  pendingSetRecord: null,
  pendingAlertId: null,
  ongoingId: null,
};

function endClock(seconds: number): string {
  const d = new Date(Date.now() + seconds * 1000);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/** Index of the next non-cardio exercise after `from`, or null if none. */
function nextExerciseIndex(workout: WorkoutDay, from: number): number | null {
  let next = from + 1;
  while (next < workout.exercises.length && workout.exercises[next].type === 'CARDIO') {
    next++;
  }
  return next < workout.exercises.length ? next : null;
}

export const useWorkoutStore = create<WorkoutState>((set, get) => {
  /** Cancel the existing alert + ongoing notification, then arm new ones for
   *  whatever phase the store is currently in. Reads live state so it works
   *  for both fresh phase entry and resume-from-pause. */
  function armForCurrentPhase() {
    const s = get();
    const {
      currentPhase,
      phaseStartedAt,
      targetDuration,
      activeWorkout,
      currentExerciseIndex,
      currentSetNumber,
      pendingAlertId,
      ongoingId,
    } = s;

    const prevAlert = pendingAlertId;
    const prevOngoing = ongoingId;
    cancelAlert(prevAlert);
    dismissOngoing(prevOngoing);

    const ex = activeWorkout?.exercises[currentExerciseIndex] ?? null;
    if (!ex || !phaseStartedAt) {
      set({ pendingAlertId: null, ongoingId: null });
      return;
    }

    const remaining =
      targetDuration != null
        ? Math.max(0, targetDuration - (Date.now() - phaseStartedAt) / 1000)
        : null;

    let alertTitle = '';
    let alertBody = '';
    let statusTitle = '';
    let statusBody = '';

    if (currentPhase === 'break') {
      alertTitle = 'Break over';
      alertBody = `${ex.name} · set ${currentSetNumber + 1} ready`;
      statusTitle = `BREAK · ${ex.name}`;
      statusBody = remaining != null ? `next set at ${endClock(remaining)}` : '';
    } else if (currentPhase === 'transition') {
      const ni = activeWorkout ? nextExerciseIndex(activeWorkout, currentExerciseIndex) : null;
      const nextName = ni != null ? activeWorkout!.exercises[ni].name : 'next exercise';
      alertTitle = "Setup time's up";
      alertBody = `Next: ${nextName}`;
      statusTitle = `SETUP · next: ${nextName}`;
      statusBody = remaining != null ? `ready at ${endClock(remaining)}` : '';
    } else if (currentPhase === 'amrap') {
      statusTitle = `AMRAP · ${ex.name}`;
      statusBody = 'counting up — tap DONE in app';
    } else {
      // set / timed
      alertTitle = 'Set complete';
      alertBody = `${ex.name} · set ${currentSetNumber} done — tap DONE`;
      statusTitle = `SET ${currentSetNumber}/${ex.sets} · ${ex.name}`;
      statusBody = remaining != null ? `target ${endClock(remaining)}` : '';
    }

    if (currentPhase !== 'amrap' && remaining != null && remaining > 0) {
      scheduleAlert(remaining, alertTitle, alertBody).then((id) => set({ pendingAlertId: id }));
    } else {
      set({ pendingAlertId: null });
    }
    presentOngoing(statusTitle, statusBody).then((id) => set({ ongoingId: id }));
  }

  return {
    ...initialState,

    startWorkout(workout, sessionId) {
      cancelAlert(get().pendingAlertId);
      dismissOngoing(get().ongoingId);
      set({
        ...initialState,
        activeWorkout: workout,
        sessionId,
        sessionStartedAt: Date.now(),
      });
    },

    startSet(targetDuration) {
      const { activeWorkout, currentExerciseIndex } = get();
      const ex = activeWorkout?.exercises[currentExerciseIndex];
      const phase: TimerPhase =
        ex?.type === 'AMRAP' ? 'amrap' : ex?.type === 'TIMED' ? 'timed' : 'set';
      set({ currentPhase: phase, phaseStartedAt: Date.now(), targetDuration, pausedAt: null });
      armForCurrentPhase();
    },

    startBreak(targetDuration) {
      set({ currentPhase: 'break', phaseStartedAt: Date.now(), targetDuration, pausedAt: null });
      armForCurrentPhase();
    },

    startTransition(targetDuration) {
      set({ currentPhase: 'transition', phaseStartedAt: Date.now(), targetDuration, pausedAt: null });
      armForCurrentPhase();
    },

    completeBreak(_actualBreakDuration) {
      const { activeWorkout, currentExerciseIndex, currentSetNumber, pendingAlertId, ongoingId } = get();
      cancelAlert(pendingAlertId);
      dismissOngoing(ongoingId);
      const ex = activeWorkout?.exercises[currentExerciseIndex];
      if (!ex) return;
      if (currentSetNumber < ex.sets) {
        set({
          currentSetNumber: currentSetNumber + 1,
          currentPhase: 'idle',
          pendingAlertId: null,
          ongoingId: null,
          pausedAt: null,
        });
      } else {
        set({ pendingAlertId: null, ongoingId: null, pausedAt: null });
      }
    },

    skipBreak() {
      get().completeBreak(0);
    },

    pause() {
      const { pausedAt, currentPhase, phaseStartedAt, pendingAlertId, ongoingId } = get();
      if (pausedAt || !phaseStartedAt || currentPhase === 'idle') return;
      cancelAlert(pendingAlertId);
      dismissOngoing(ongoingId);
      set({ pausedAt: Date.now(), pendingAlertId: null, ongoingId: null });
      presentOngoing('⏸ Paused', 'Open the app to resume your timer').then((id) =>
        set({ ongoingId: id }),
      );
    },

    resume() {
      const { pausedAt, phaseStartedAt } = get();
      if (!pausedAt || !phaseStartedAt) return;
      const pausedDuration = Date.now() - pausedAt;
      set({ phaseStartedAt: phaseStartedAt + pausedDuration, pausedAt: null });
      armForCurrentPhase();
    },

    addSetRecord(record) {
      set((s) => ({ setRecords: [...s.setRecords, record] }));
    },

    patchLastBreak(actualBreakDuration) {
      set((s) => {
        if (s.setRecords.length === 0) return s;
        const records = s.setRecords.slice();
        records[records.length - 1] = {
          ...records[records.length - 1],
          actualBreakDuration,
        };
        return { setRecords: records };
      });
    },

    setPendingSetRecord(record) {
      set({ pendingSetRecord: record });
    },

    advanceToNextExercise() {
      const { activeWorkout, currentExerciseIndex, pendingAlertId, ongoingId } = get();
      if (!activeWorkout) return false;
      const next = nextExerciseIndex(activeWorkout, currentExerciseIndex);
      if (next == null) return false;
      cancelAlert(pendingAlertId);
      dismissOngoing(ongoingId);
      set({
        currentExerciseIndex: next,
        currentSetNumber: 1,
        currentPhase: 'idle',
        pendingAlertId: null,
        ongoingId: null,
        pausedAt: null,
      });
      return true;
    },

    abandonWorkout() {
      cancelAlert(get().pendingAlertId);
      dismissOngoing(get().ongoingId);
      set({ ...initialState, currentPhase: 'idle' });
    },

    dismissWarning() {
      set({ warningDismissed: true });
    },

    reset() {
      cancelAlert(get().pendingAlertId);
      dismissOngoing(get().ongoingId);
      set({ ...initialState, currentPhase: 'idle' });
    },
  };
});

export function getCurrentExercise(): Exercise | null {
  const { activeWorkout, currentExerciseIndex } = useWorkoutStore.getState();
  return activeWorkout?.exercises[currentExerciseIndex] ?? null;
}

/** The next non-cardio exercise after the current one, or null if it's the last. */
export function getNextExercise(): Exercise | null {
  const { activeWorkout, currentExerciseIndex } = useWorkoutStore.getState();
  if (!activeWorkout) return null;
  let next = currentExerciseIndex + 1;
  while (next < activeWorkout.exercises.length && activeWorkout.exercises[next].type === 'CARDIO') {
    next++;
  }
  return next < activeWorkout.exercises.length ? activeWorkout.exercises[next] : null;
}
