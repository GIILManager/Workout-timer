import { useEffect, useRef, useState } from 'react';
import { triggerTimerAlert } from '../utils/alertService';

interface TimerState {
  elapsed: number;
  remaining: number;
  isOvertime: boolean;
  hasAlerted: boolean;
}

export function useTimer(
  phase: 'set' | 'break' | 'amrap' | 'timed' | 'idle',
  targetDuration: number | null,
  phaseStartedAt: number | null,
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

    const tick = () => {
      const now = Date.now();
      const elapsed = (now - phaseStartedAt) / 1000;

      if (phase === 'amrap') {
        setState({ elapsed, remaining: 0, isOvertime: false, hasAlerted: false });
        return;
      }

      const target = targetDuration ?? 0;
      const remaining = target - elapsed;
      const isOvertime = remaining < 0;

      if (isOvertime && !alertedRef.current) {
        alertedRef.current = true;
        triggerTimerAlert();
      }

      setState({ elapsed, remaining, isOvertime, hasAlerted: alertedRef.current });
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [phase, targetDuration, phaseStartedAt]);

  return state;
}
