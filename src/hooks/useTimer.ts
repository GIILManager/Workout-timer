import { useEffect, useRef, useState } from 'react';
import { triggerTimerAlert } from '../utils/alertService';

interface TimerState {
  elapsed: number;
  remaining: number;
  isOvertime: boolean;
  hasAlerted: boolean;
}

export function useTimer(
  phase: 'set' | 'break' | 'amrap' | 'timed' | 'transition' | 'idle',
  targetDuration: number | null,
  phaseStartedAt: number | null,
  pausedAt: number | null = null,
) {
  const [state, setState] = useState<TimerState>({
    elapsed: 0,
    remaining: targetDuration ?? 0,
    isOvertime: false,
    hasAlerted: false,
  });

  const alertedRef = useRef(false);

  useEffect(() => {
    alertedRef.current = false;
    setState({
      elapsed: 0,
      remaining: targetDuration ?? 0,
      isOvertime: false,
      hasAlerted: false,
    });
  }, [phaseStartedAt, phase]);

  useEffect(() => {
    if (phase === 'idle' || !phaseStartedAt) return;

    const compute = (atMs: number) => {
      const elapsed = (atMs - phaseStartedAt) / 1000;

      if (phase === 'amrap') {
        setState({ elapsed, remaining: 0, isOvertime: false, hasAlerted: false });
        return;
      }

      const target = targetDuration ?? 0;
      const remaining = target - elapsed;
      const isOvertime = remaining < 0;

      // Alert once when the allotted time is up — for the SET phase as well as
      // BREAK, so you know to pick up the pace. 3 pulses for rest, 2 for a set.
      if (isOvertime && !alertedRef.current && pausedAt == null) {
        alertedRef.current = true;
        triggerTimerAlert(phase === 'break' || phase === 'transition' ? 3 : 2);
      }

      setState({ elapsed, remaining, isOvertime, hasAlerted: alertedRef.current });
    };

    // Paused: freeze the display at the paused moment and stop ticking.
    if (pausedAt != null) {
      compute(pausedAt);
      return;
    }

    compute(Date.now());
    const id = setInterval(() => compute(Date.now()), 500);
    return () => clearInterval(id);
  }, [phase, targetDuration, phaseStartedAt, pausedAt]);

  return state;
}
