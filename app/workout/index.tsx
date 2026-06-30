import { router } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useCallback } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CircularTimer } from '../../src/components/CircularTimer';
import { SetDots } from '../../src/components/SetDots';
import { useHistoryStore } from '../../src/store/historyStore';
import { useWorkoutStore, getNextExercise } from '../../src/store/workoutStore';
import { useTimer } from '../../src/hooks/useTimer';
import { useWorkoutDuration } from '../../src/hooks/useWorkoutDuration';
import { getAdaptedTiming, getAdaptedTransition } from '../../src/utils/timing';
import { formatTime, formatElapsed } from '../../src/utils/time';
import { stopAlert } from '../../src/utils/alertService';
import { SetRecord, TimingRecord } from '../../src/types';

export default function WorkoutScreen() {
  useKeepAwake();

  const store = useWorkoutStore();
  const { addTimingRecord, saveSession } = useHistoryStore();
  const settings = useHistoryStore((s) => s.settings);
  const timingRecords = useHistoryStore((s) => s.timingRecords);

  const {
    activeWorkout,
    sessionId,
    sessionStartedAt,
    currentExerciseIndex,
    currentSetNumber,
    currentPhase,
    phaseStartedAt,
    targetDuration,
    pausedAt,
    warningDismissed,
  } = store;

  const { elapsed, remaining, isOvertime } = useTimer(
    currentPhase as any,
    targetDuration,
    phaseStartedAt,
    pausedAt,
  );

  const duration = useWorkoutDuration(
    sessionStartedAt,
    settings.targetWorkoutMinutes,
    settings.warningWorkoutMinutes,
    warningDismissed,
  );

  const exercise = activeWorkout?.exercises[currentExerciseIndex] ?? null;
  const isPaused = pausedAt != null;
  const isBreak = currentPhase === 'break';
  const isTransition = currentPhase === 'transition';
  const isAmrap = currentPhase === 'amrap';
  const isCountdown = isBreak || isTransition; // counts DOWN

  const progress = (() => {
    if (!targetDuration || isAmrap) return 0;
    if (isCountdown) return Math.max(0, remaining / targetDuration);
    return Math.min(1, elapsed / targetDuration);
  })();

  const finishSession = useCallback(async () => {
    const freshState = useWorkoutStore.getState();
    const { sessionId: sid, sessionStartedAt: startedAt, activeWorkout: workout, setRecords: records } = freshState;
    if (!sid || !startedAt || !workout) return;
    const totalDuration = (Date.now() - startedAt) / 1000;
    const distinctExercises = new Set(records.map((r) => r.exerciseId)).size;
    await saveSession({
      id: sid,
      day: workout.day,
      date: new Date().toISOString(),
      totalDuration,
      exercisesCompleted: distinctExercises,
      setRecords: records,
    });
    store.reset();
    router.replace('/complete');
  }, [saveSession]);

  // SET / AMRAP / TIMED finished → record the set, then break, transition, or finish.
  const handleCompleteSet = useCallback(async () => {
    if (!exercise || !sessionId || !phaseStartedAt) return;
    stopAlert();

    const actualSetDuration = isAmrap ? null : (Date.now() - phaseStartedAt) / 1000;
    const timing = getAdaptedTiming(exercise.id, exercise.type, timingRecords, settings);

    const setRecord: SetRecord = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      setNumber: currentSetNumber,
      predictedSetDuration: timing.setDuration,
      actualSetDuration,
      predictedBreakDuration: timing.breakDuration,
      actualBreakDuration: 0,
      completedAt: new Date().toISOString(),
    };
    store.addSetRecord(setRecord);

    // Learn the set duration now (break/transition is recorded when it ends).
    await addTimingRecord({
      exerciseId: exercise.id,
      setNumber: currentSetNumber,
      setDuration: actualSetDuration,
      breakDuration: null,
      date: new Date().toISOString(),
      sessionId,
    });

    const isLastSet = currentSetNumber >= exercise.sets;
    if (!isLastSet) {
      store.startBreak(timing.breakDuration);
      return;
    }
    const next = getNextExercise();
    if (next) {
      store.startTransition(getAdaptedTransition(next.id, timingRecords, settings));
    } else {
      await finishSession();
    }
  }, [exercise, sessionId, phaseStartedAt, isAmrap, currentSetNumber, timingRecords, settings, finishSession]);

  // BREAK finished (always within the same exercise now) → next set.
  const handleStartNextSet = useCallback(async () => {
    if (!exercise || !sessionId || !phaseStartedAt) return;
    stopAlert();
    const actualBreakDuration = (Date.now() - phaseStartedAt) / 1000;
    store.patchLastBreak(actualBreakDuration);

    const timingRecord: TimingRecord = {
      exerciseId: exercise.id,
      setNumber: currentSetNumber,
      setDuration: null,
      breakDuration: actualBreakDuration,
      date: new Date().toISOString(),
      sessionId,
    };
    await addTimingRecord(timingRecord);

    store.completeBreak(actualBreakDuration);
    const timing = getAdaptedTiming(exercise.id, exercise.type, timingRecords, settings);
    store.startSet(timing.setDuration);
  }, [exercise, sessionId, phaseStartedAt, currentSetNumber, timingRecords, settings]);

  // SKIP BREAK → record the actual (short) break for history, but don't feed it
  // into learning (a deliberate skip isn't representative of needed rest).
  const handleSkipBreak = useCallback(() => {
    if (!exercise || !phaseStartedAt) return;
    stopAlert();
    const actualBreakDuration = (Date.now() - phaseStartedAt) / 1000;
    store.patchLastBreak(actualBreakDuration);
    store.completeBreak(actualBreakDuration);
    const timing = getAdaptedTiming(exercise.id, exercise.type, timingRecords, settings);
    store.startSet(timing.setDuration);
  }, [exercise, phaseStartedAt, timingRecords, settings]);

  // TRANSITION finished → learn the setup time, advance to next exercise.
  const handleContinueToNext = useCallback(async (record: boolean) => {
    if (!sessionId || !phaseStartedAt) return;
    stopAlert();
    const actualTransition = (Date.now() - phaseStartedAt) / 1000;
    const next = getNextExercise();
    if (record && next) {
      await addTimingRecord({
        exerciseId: next.id,
        setNumber: 0,
        setDuration: null,
        breakDuration: actualTransition,
        date: new Date().toISOString(),
        sessionId,
        transition: true,
      });
    }
    const hasMore = store.advanceToNextExercise();
    if (hasMore) {
      const freshIdx = useWorkoutStore.getState().currentExerciseIndex;
      const nextEx = activeWorkout!.exercises[freshIdx];
      const timing = getAdaptedTiming(nextEx.id, nextEx.type, timingRecords, settings);
      store.startSet(timing.setDuration);
    } else {
      await finishSession();
    }
  }, [sessionId, phaseStartedAt, timingRecords, settings, activeWorkout, finishSession]);

  const handleTogglePause = useCallback(() => {
    if (isPaused) store.resume();
    else store.pause();
  }, [isPaused]);

  const handleAbandon = useCallback(() => {
    Alert.alert('Abandon Workout?', 'Your progress will not be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Abandon',
        style: 'destructive',
        onPress: () => {
          stopAlert();
          store.abandonWorkout();
          router.replace('/');
        },
      },
    ]);
  }, []);

  const elapsedColor = (() => {
    if (duration.elapsedSeconds >= settings.warningWorkoutMinutes * 60) return '#EF4444';
    if (duration.elapsedSeconds >= settings.targetWorkoutMinutes * 60) return '#F59E0B';
    return '#F0F0F0';
  })();

  if (!exercise || !activeWorkout) return null;

  const nextEx = getNextExercise();

  const timerLabel = (() => {
    if (isCountdown && isOvertime) return `+${formatTime(-remaining)}`;
    if (isCountdown) return formatTime(remaining);
    if (isAmrap) return elapsed < 1 ? 'GO' : formatTime(elapsed);
    return formatTime(elapsed);
  })();

  const subLabel = (() => {
    if (isPaused) return 'Paused';
    if (isCountdown && isOvertime) return 'Overtime';
    if (isTransition) return 'Setup';
    if (isBreak) return 'Remaining';
    if (isAmrap) return 'to failure';
    return 'Elapsed';
  })();

  const timerColor = (() => {
    if (isCountdown && isOvertime) return '#EF4444';
    if (isAmrap) return '#22D46E';
    return '#F0F0F0';
  })();

  const progressBarWidth = `${(duration.progressToTarget * 100).toFixed(0)}%`;

  const setProgressLabel = (() => {
    const repsLabel = exercise.type === 'AMRAP' ? 'to failure' : exercise.reps;
    return `SET ${currentSetNumber} OF ${exercise.sets}  ·  ${repsLabel}`;
  })();

  const midLabel = (() => {
    if (isTransition) return nextEx ? `NEXT  ·  ${nextEx.name}` : 'SETUP';
    if (isBreak) return `BREAK  ·  SET ${currentSetNumber + 1} NEXT`;
    return setProgressLabel;
  })();

  return (
    <SafeAreaView style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleAbandon}>
          <Text style={styles.closeIcon}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.elapsed, { color: elapsedColor }]}>
          {formatElapsed(duration.elapsedSeconds)}
        </Text>
        <TouchableOpacity style={styles.headerBtn} onPress={handleTogglePause}>
          <Text style={styles.pauseIcon}>{isPaused ? '▶' : '⏸'}</Text>
        </TouchableOpacity>
        <View style={styles.progressArea}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: progressBarWidth as any }]} />
          </View>
          <Text style={styles.targetLabel}>{settings.targetWorkoutMinutes}m</Text>
        </View>
      </View>

      {/* Exercise info */}
      <View style={styles.exerciseBlock}>
        <View style={styles.exerciseTitleRow}>
          <Text style={styles.exerciseName} numberOfLines={2}>{exercise.name}</Text>
          {exercise.type === 'TIER1' && (
            <View style={styles.t1Badge}><Text style={styles.t1Text}>T1</Text></View>
          )}
          {exercise.type === 'AMRAP' && (
            <View style={styles.amrapBadge}><Text style={styles.amrapText}>AMRAP</Text></View>
          )}
        </View>
        <Text style={[
          styles.setProgress,
          isBreak ? styles.setProgressBreak : {},
          isTransition ? styles.setProgressTransition : {},
        ]}>
          {midLabel}
        </Text>
      </View>

      {/* Circular Timer */}
      <View style={styles.timerContainer}>
        <View style={styles.timerRing}>
          <CircularTimer
            phase={currentPhase as any}
            isOvertime={isOvertime}
            progress={progress}
          />
          <View style={styles.timerCenter}>
            <Text style={[styles.timerText, { color: isPaused ? '#888' : timerColor }]}>{timerLabel}</Text>
            <Text style={[styles.timerSubLabel, isCountdown && isOvertime ? { color: '#EF4444' } : {}]}>
              {subLabel}
            </Text>
          </View>
        </View>
        {targetDuration && !isAmrap && (
          <Text style={styles.targetDuration}>
            target: <Text style={{ color: '#F0F0F0' }}>{formatTime(targetDuration)}</Text>
          </Text>
        )}
        {isAmrap && (
          <Text style={styles.amrapHint}>go until failure · tap done when finished</Text>
        )}
      </View>

      {/* Set dots */}
      <SetDots
        totalSets={exercise.sets}
        currentSet={currentSetNumber}
        completedSets={currentSetNumber - 1}
      />

      {/* CTAs */}
      <View style={styles.ctaBlock}>
        {isTransition ? (
          <>
            <TouchableOpacity
              style={styles.transitionBtn}
              onPress={() => handleContinueToNext(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.transitionBtnText}>▶  START NEXT EXERCISE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipBreakBtn}
              onPress={() => handleContinueToNext(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBreakText}>SKIP SETUP</Text>
            </TouchableOpacity>
          </>
        ) : isBreak ? (
          <>
            <TouchableOpacity
              style={styles.nextSetBtn}
              onPress={handleStartNextSet}
              activeOpacity={0.85}
            >
              <Text style={styles.nextSetText}>▶  START NEXT SET</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.skipBreakBtn}
              onPress={handleSkipBreak}
              activeOpacity={0.7}
            >
              <Text style={styles.skipBreakText}>SKIP BREAK</Text>
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={handleCompleteSet}
            activeOpacity={0.85}
          >
            <Text style={styles.doneBtnText}>✓  DONE</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 2-hour warning overlay */}
      {duration.shouldShowWarning && !warningDismissed && (
        <View style={styles.warningOverlay}>
          <View style={styles.warningCard}>
            <Text style={styles.warningIcon}>⚠</Text>
            <Text style={styles.warningTitle}>2 Hours In</Text>
            <Text style={styles.warningBody}>
              You've been training for over 2 hours. Consider wrapping up or finishing your last exercise.
            </Text>
            <TouchableOpacity
              style={styles.warningBtn}
              onPress={() => store.dismissWarning()}
              activeOpacity={0.85}
            >
              <Text style={styles.warningBtnText}>GOT IT, KEEP GOING</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0A0A0A' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 8,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeIcon: { fontSize: 20, color: '#888' },
  pauseIcon: { fontSize: 18, color: '#888' },
  elapsed: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressArea: { alignItems: 'flex-end', gap: 4, marginLeft: 8 },
  progressTrack: { width: 64, height: 4, borderRadius: 2, backgroundColor: '#1C1C1C', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#22D46E', borderRadius: 2 },
  targetLabel: { fontSize: 10, color: '#888' },

  exerciseBlock: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  exerciseTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exerciseName: { flex: 1, fontSize: 20, fontWeight: '700', color: '#F0F0F0', lineHeight: 26 },
  t1Badge: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  t1Text: { color: '#F59E0B', fontSize: 10, fontWeight: '800' },
  amrapBadge: { backgroundColor: 'rgba(59,130,246,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  amrapText: { color: '#3B82F6', fontSize: 10, fontWeight: '800' },
  setProgress: { fontSize: 14, fontWeight: '500', color: '#888', marginTop: 6 },
  setProgressBreak: { color: '#3B82F6' },
  setProgressTransition: { color: '#F59E0B' },

  timerContainer: { alignItems: 'center', paddingTop: 24, paddingBottom: 8 },
  timerRing: { width: 280, height: 280, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  timerCenter: {
    position: 'absolute',
    alignItems: 'center', justifyContent: 'center',
  },
  timerText: { fontSize: 52, fontWeight: '900', letterSpacing: -2, fontVariant: ['tabular-nums'], lineHeight: 60 },
  timerSubLabel: { fontSize: 12, fontWeight: '500', color: '#888', textTransform: 'uppercase', letterSpacing: 2, marginTop: 6 },
  targetDuration: { fontSize: 12, color: '#888', marginTop: 12 },
  amrapHint: { fontSize: 12, color: '#888', marginTop: 12 },

  ctaBlock: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: 16, paddingBottom: 32, gap: 10,
  },
  doneBtn: {
    height: 64, borderRadius: 16, backgroundColor: '#22D46E',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#22D46E', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  doneBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },
  nextSetBtn: {
    height: 64, borderRadius: 16, backgroundColor: '#3B82F6',
    alignItems: 'center', justifyContent: 'center',
  },
  nextSetText: { color: '#fff', fontSize: 17, fontWeight: '800' },
  transitionBtn: {
    height: 64, borderRadius: 16, backgroundColor: '#F59E0B',
    alignItems: 'center', justifyContent: 'center',
  },
  transitionBtnText: { color: '#000', fontSize: 17, fontWeight: '800' },
  skipBreakBtn: {
    height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#262626',
    alignItems: 'center', justifyContent: 'center',
  },
  skipBreakText: { color: '#888', fontSize: 15, fontWeight: '600' },

  warningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center', justifyContent: 'center',
    padding: 32,
  },
  warningCard: {
    backgroundColor: '#1C1C1C', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 20, padding: 32, width: '100%', alignItems: 'center',
  },
  warningIcon: { fontSize: 36, color: '#EF4444' },
  warningTitle: { fontSize: 24, fontWeight: '800', color: '#F0F0F0', marginTop: 16, textAlign: 'center' },
  warningBody: { fontSize: 14, lineHeight: 22, color: '#888', textAlign: 'center', marginTop: 8 },
  warningBtn: {
    marginTop: 28, width: '100%', height: 56, borderRadius: 14,
    backgroundColor: '#22D46E', alignItems: 'center', justifyContent: 'center',
  },
  warningBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },
});
