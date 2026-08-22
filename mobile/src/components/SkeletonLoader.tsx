import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.8, { duration: 800 }), -1, true);
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function EventCardSkeleton() {
  return (
    <View style={styles.cardSkeleton}>
      <SkeletonLoader width="100%" height={180} borderRadius={12} />
      <View style={{ padding: 16, gap: 8 }}>
        <SkeletonLoader width="40%" height={14} />
        <SkeletonLoader width="80%" height={20} />
        <SkeletonLoader width="60%" height={14} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#3E345D',
  },
  cardSkeleton: {
    backgroundColor: '#2D224C',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
});
