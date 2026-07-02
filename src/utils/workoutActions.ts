import { router } from 'expo-router';
import { useHistoryStore } from '../store/historyStore';
import { useWorkoutStore, getNextExercise } from '../store/workoutStore';
import { getAdaptedTiming, getAdaptedTransition } from './timing';
import { stopAlert } from './alertService';
import { SetRecord, TimingRecord } from '../types';

/**
 * Phase-advancing actions, extracted from the workout screen so they can be
 * driven from two places: the on-screen buttons AND the notification action
 * buttons ("Done" / "Start next set") pressed while the app is backgrounded
 * or the phone is locked. Everything reads live store state via getState(),
 * and every action guards on the current phase so a stale notification tap
 * (e.g. after the phase already advanced in-app) is a harmless no-op.
 */

export type ActionOutcome = 'break' | 'transition' | 'set' | 'finished' | 'noop';

async function finishSession(): Promise<void> {
  const ws = useWorkoutStore.getState();
  const { sessionId, sessionStartedAt, activeWorkout, setRecords } = ws;
  if (!sessionId || !sessionStartedAt || !activeWorkout) return;
  const totalDuration = (Date.now() - sessionStartedAt) / 1000;
  const distinctExercises = new Set(setRecords.map((r) => r.exerciseId)).size;
  await useHistoryStore.getState().saveSession({
    id: sessionId,
    day: activeWorkout.day,
    date: new Date().toISOString(),
    totalDuration,
    exercisesCompleted: distinctExercises,
    setRecords,
  });
  ws.reset();
  // No navigator when invoked from a headless notification event — the saved
  // session still shows up in History, so silently skipping is fine.
  try {
    router.replace('/complete');
  } catch {}
}

/** SET / AMRAP / TIMED finished → record the set, then break, transition, or finish. */
export async function completeCurrentSet(): Promise<ActionOutcome> {
  const ws = useWorkoutStore.getState();
  const hs = useHistoryStore.getState();
  const exercise = ws.activeWorkout?.exercises[ws.currentExerciseIndex] ?? null;
  const phase = ws.currentPhase;
  if (!exercise || !ws.sessionId || !ws.phaseStartedAt) return 'noop';
  if (phase !== 'set' && phase !== 'timed' && phase !== 'amrap') return 'noop';
  stopAlert();

  const isAmrap = phase === 'amrap';
  const actualSetDuration = isAmrap ? null : (Date.now() - ws.phaseStartedAt) / 1000;
  const timing = getAdaptedTiming(exercise.id, exercise.type, hs.timingRecords, hs.settings);

  const setRecord: SetRecord = {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    setNumber: ws.currentSetNumber,
    predictedSetDuration: timing.setDuration,
    actualSetDuration,
    predictedBreakDuration: timing.breakDuration,
    actualBreakDuration: 0,
    completedAt: new Date().toISOString(),
  };
  ws.addSetRecord(setRecord);

  // Learn the set duration now (break/transition is recorded when it ends).
  await hs.addTimingRecord({
    exerciseId: exercise.id,
    setNumber: ws.currentSetNumber,
    setDuration: actualSetDuration,
    breakDuration: null,
    date: new Date().toISOString(),
    sessionId: ws.sessionId,
  });

  const isLastSet = ws.currentSetNumber >= exercise.sets;
  if (!isLastSet) {
    ws.startBreak(timing.breakDuration);
    return 'break';
  }
  const next = getNextExercise();
  if (next) {
    ws.startTransition(getAdaptedTransition(next.id, hs.timingRecords, hs.settings));
    return 'transition';
  }
  await finishSession();
  return 'finished';
}

/** BREAK finished (always within the same exercise) → next set. */
export async function startNextSet(): Promise<ActionOutcome> {
  const ws = useWorkoutStore.getState();
  const hs = useHistoryStore.getState();
  const exercise = ws.activeWorkout?.exercises[ws.currentExerciseIndex] ?? null;
  if (!exercise || !ws.sessionId || !ws.phaseStartedAt || ws.currentPhase !== 'break') return 'noop';
  stopAlert();
  const actualBreakDuration = (Date.now() - ws.phaseStartedAt) / 1000;
  ws.patchLastBreak(actualBreakDuration);

  const timingRecord: TimingRecord = {
    exerciseId: exercise.id,
    setNumber: ws.currentSetNumber,
    setDuration: null,
    breakDuration: actualBreakDuration,
    date: new Date().toISOString(),
    sessionId: ws.sessionId,
  };
  await hs.addTimingRecord(timingRecord);

  ws.completeBreak(actualBreakDuration);
  const timing = getAdaptedTiming(exercise.id, exercise.type, hs.timingRecords, hs.settings);
  ws.startSet(timing.setDuration);
  return 'set';
}

/**
 * SKIP BREAK → record the actual (short) break for history, but don't feed it
 * into learning (a deliberate skip isn't representative of needed rest).
 */
export function skipBreak(): ActionOutcome {
  const ws = useWorkoutStore.getState();
  const hs = useHistoryStore.getState();
  const exercise = ws.activeWorkout?.exercises[ws.currentExerciseIndex] ?? null;
  if (!exercise || !ws.phaseStartedAt || ws.currentPhase !== 'break') return 'noop';
  stopAlert();
  const actualBreakDuration = (Date.now() - ws.phaseStartedAt) / 1000;
  ws.patchLastBreak(actualBreakDuration);
  ws.completeBreak(actualBreakDuration);
  const timing = getAdaptedTiming(exercise.id, exercise.type, hs.timingRecords, hs.settings);
  ws.startSet(timing.setDuration);
  return 'set';
}

/** TRANSITION finished → optionally learn the setup time, advance to next exercise. */
export async function continueToNextExercise(record: boolean): Promise<ActionOutcome> {
  const ws = useWorkoutStore.getState();
  const hs = useHistoryStore.getState();
  if (!ws.sessionId || !ws.phaseStartedAt || ws.currentPhase !== 'transition') return 'noop';
  stopAlert();
  const actualTransition = (Date.now() - ws.phaseStartedAt) / 1000;
  const next = getNextExercise();
  if (record && next) {
    await hs.addTimingRecord({
      exerciseId: next.id,
      setNumber: 0,
      setDuration: null,
      breakDuration: actualTransition,
      date: new Date().toISOString(),
      sessionId: ws.sessionId,
      transition: true,
    });
  }
  const hasMore = ws.advanceToNextExercise();
  if (hasMore) {
    const fresh = useWorkoutStore.getState();
    const nextEx = fresh.activeWorkout!.exercises[fresh.currentExerciseIndex];
    const timing = getAdaptedTiming(nextEx.id, nextEx.type, hs.timingRecords, hs.settings);
    fresh.startSet(timing.setDuration);
    return 'set';
  }
  await finishSession();
  return 'finished';
}
