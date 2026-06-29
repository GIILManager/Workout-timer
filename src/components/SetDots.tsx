import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

interface Props {
  totalSets: number;
  currentSet: number;
  completedSets: number;
}

function PulsingDot({ active }: { active: boolean }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (active) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.18, { duration: 800 }),
          withTiming(1, { duration: 800 }),
        ),
        -1,
        false,
      );
    } else {
      scale.value = 1;
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        styles.dot,
        active ? styles.dotCurrent : styles.dotCompleted,
        animStyle,
      ]}
    />
  );
}

export function SetDots({ totalSets, currentSet, completedSets }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalSets }).map((_, i) => {
        const setNum = i + 1;
        const isCompleted = setNum <= completedSets;
        const isCurrent = setNum === currentSet;
        const isRemaining = setNum > currentSet;

        if (isCurrent) {
          return <PulsingDot key={i} active />;
        }
        return (
          <View
            key={i}
            style={[
              styles.dot,
              isCompleted ? styles.dotCompleted : styles.dotRemaining,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginTop: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotCompleted: {
    backgroundColor: '#22D46E',
  },
  dotCurrent: {
    backgroundColor: '#22D46E',
  },
  dotRemaining: {
    borderWidth: 1.5,
    borderColor: '#262626',
  },
});
