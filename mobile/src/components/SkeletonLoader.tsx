import React, { useEffect } from 'react';
import { StyleSheet, View, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { BRAND_COLORS } from '../constants/config';

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
    opacity.value = withRepeat(withTiming(0.7, { duration: 800 }), -1, true);
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

export function HomeSkeletonLoader() {
  return (
    <View style={styles.homeSkeletonContainer}>
      <View style={styles.searchSkeletonWrapper}>
        <SkeletonLoader height={48} borderRadius={14} />
      </View>

      <View style={styles.tagsRowSkeleton}>
        <SkeletonLoader width={80} height={36} borderRadius={20} style={styles.tagSkeleton} />
        <SkeletonLoader width={100} height={36} borderRadius={20} style={styles.tagSkeleton} />
        <SkeletonLoader width={90} height={36} borderRadius={20} style={styles.tagSkeleton} />
        <SkeletonLoader width={85} height={36} borderRadius={20} style={styles.tagSkeleton} />
      </View>

      <View style={styles.heroSkeletonCard}>
        <SkeletonLoader height={190} borderRadius={16} />
      </View>

      <View style={styles.sectionHeaderSkeleton}>
        <SkeletonLoader width={160} height={20} borderRadius={6} />
        <SkeletonLoader width={60} height={16} borderRadius={6} />
      </View>

      <View style={styles.trendingRowSkeleton}>
        <SkeletonLoader width={220} height={260} borderRadius={16} style={styles.trendingCardSkeleton} />
        <SkeletonLoader width={220} height={260} borderRadius={16} style={styles.trendingCardSkeleton} />
      </View>

      <View style={styles.sectionHeaderSkeleton}>
        <SkeletonLoader width={180} height={20} borderRadius={6} />
      </View>
      <View style={styles.verticalCardSkeleton}>
        <SkeletonLoader height={180} borderRadius={16} />
      </View>
      <View style={styles.verticalCardSkeleton}>
        <SkeletonLoader height={180} borderRadius={16} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#27272E',
  },
  homeSkeletonContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchSkeletonWrapper: {
    marginBottom: 16,
  },
  tagsRowSkeleton: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  tagSkeleton: {
    marginRight: 4,
  },
  heroSkeletonCard: {
    marginBottom: 24,
    backgroundColor: BRAND_COLORS.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.borderLight,
    overflow: 'hidden',
  },
  sectionHeaderSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  trendingRowSkeleton: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  trendingCardSkeleton: {
    backgroundColor: BRAND_COLORS.secondary,
    borderWidth: 1,
    borderColor: BRAND_COLORS.borderLight,
  },
  verticalCardSkeleton: {
    marginBottom: 16,
    backgroundColor: BRAND_COLORS.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BRAND_COLORS.borderLight,
    overflow: 'hidden',
  },
});
