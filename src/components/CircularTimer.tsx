import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const RADIUS = 128;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = 280;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  phase: 'set' | 'break' | 'amrap' | 'timed' | 'transition' | 'idle';
  isOvertime: boolean;
  progress: number;
}

function getStrokeColor(phase: Props['phase'], isOvertime: boolean): string {
  if (phase === 'break') return isOvertime ? '#EF4444' : '#3B82F6';
  if (phase === 'transition') return isOvertime ? '#EF4444' : '#F59E0B';
  return '#22D46E';
}

export function CircularTimer({ phase, isOvertime, progress }: Props) {
  const animProgress = useSharedValue(progress);
  const amrapRotation = useSharedValue(0);

  useEffect(() => {
    if (phase === 'amrap') {
      amrapRotation.value = withRepeat(
        withTiming(360, { duration: 2600, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      amrapRotation.value = 0;
    }
  }, [phase]);

  useEffect(() => {
    if (phase !== 'amrap') {
      animProgress.value = withTiming(progress, { duration: 500 });
    }
  }, [progress, phase]);

  const color = getStrokeColor(phase, isOvertime);

  const ringProps = useAnimatedProps(() => {
    if (phase === 'amrap') {
      return {
        strokeDashoffset: 0,
        transform: [
          { translateX: SIZE / 2 },
          { translateY: SIZE / 2 },
          { rotate: `${amrapRotation.value}deg` },
          { translateX: -SIZE / 2 },
          { translateY: -SIZE / 2 },
        ],
      } as any;
    }
    const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, animProgress.value)));
    return { strokeDashoffset: offset } as any;
  });

  const dasharray = phase === 'amrap' ? `${CIRCUMFERENCE * 0.25} ${CIRCUMFERENCE * 0.75}` : `${CIRCUMFERENCE}`;

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="#1C1C1C"
          strokeWidth={12}
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={dasharray}
          animatedProps={ringProps}
          transform={phase === 'amrap' ? undefined : `rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    position: 'relative',
  },
});
