import { useEffect, useState } from 'react';

interface WorkoutDurationState {
  elapsedSeconds: number;
  progressToTarget: number;
  shouldShowWarning: boolean;
}

export function useWorkoutDuration(
  sessionStartedAt: number | null,
  targetMinutes: number,
  warningMinutes: number,
  warningDismissed: boolean,
): WorkoutDurationState {
  const [state, setState] = useState<WorkoutDurationState>({
    elapsedSeconds: 0,
    progressToTarget: 0,
    shouldShowWarning: false,
  });

  useEffect(() => {
    if (!sessionStartedAt) {
      setState({ elapsedSeconds: 0, progressToTarget: 0, shouldShowWarning: false });
      return;
    }

    const tick = () => {
      const elapsedSeconds = (Date.now() - sessionStartedAt) / 1000;
      const targetSeconds = targetMinutes * 60;
      const warningSeconds = warningMinutes * 60;
      setState({
        elapsedSeconds,
        progressToTarget: Math.min(1, elapsedSeconds / targetSeconds),
        shouldShowWarning: elapsedSeconds >= warningSeconds && !warningDismissed,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sessionStartedAt, targetMinutes, warningMinutes, warningDismissed]);

  return state;
}
