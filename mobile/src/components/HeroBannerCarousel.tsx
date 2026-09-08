import React, { useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated';
import { BRAND_COLORS } from '../constants/config';
import { EventItem, getPosterImage } from './EventCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_BANNER_HEIGHT = Math.round(SCREEN_WIDTH * (9 / 21));
const AUTOPLAY_INTERVAL_MS = 4000; 

interface HeroBannerCarouselProps {
  items: EventItem[];
  onPressItem: (item: EventItem) => void;
}

interface SlideItemProps {
  item: EventItem;
  index: number;
  scrollX: SharedValue<number>;
  onPress: () => void;
}

function HeroSlideItem({ item, index, scrollX, onPress }: SlideItemProps) {
  const imageAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      scrollX.value,
      [(index - 1) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 1) * SCREEN_WIDTH],
      [-SCREEN_WIDTH * 0.12, 0, SCREEN_WIDTH * 0.12],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={styles.heroSlide}
      accessibilityRole="button"
      accessibilityLabel={`Buka konser unggulan ${item.title}`}
    >
      <View style={styles.imageOverflowWrap}>
        <Animated.View style={[styles.imageContainer, imageAnimatedStyle]}>
          <Image
            source={{ uri: getPosterImage(item) }}
            style={styles.heroImage}
            contentFit="cover"
            transition={200}
          />
        </Animated.View>
      </View>

      <View style={styles.heroContentOverlay}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroUrgentBadge}>
            <Ionicons name="sparkles" size={11} color="#09090B" />
            <Text style={styles.heroUrgentText}>POPULER</Text>
          </View>
          {item.venue?.city && (
            <View style={styles.heroCityBadge}>
              <Text style={styles.heroCityText}>📍 {item.venue.city}</Text>
            </View>
          )}
        </View>

        <Text style={styles.heroTitle} numberOfLines={1}>
          {item.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

interface PaginationDotProps {
  index: number;
  scrollX: SharedValue<number>;
}

function MorphingPaginationDot({ index, scrollX }: PaginationDotProps) {
  const dotAnimatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const width = interpolate(
      scrollX.value,
      inputRange,
      [5, 20, 5],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.35, 1, 0.35],
      Extrapolation.CLAMP
    );

    return {
      width,
      opacity,
      backgroundColor: opacity > 0.6 ? BRAND_COLORS.accent : '#FAFAFA',
    };
  });

  return <Animated.View style={[styles.heroDot, dotAnimatedStyle]} />;
}

export function HeroBannerCarousel({ items, onPressItem }: HeroBannerCarouselProps) {
  const scrollX = useSharedValue(0);
  const flatListRef = useRef<FlatList<EventItem>>(null);
  const currentIndexRef = useRef(0);
  const isInteractingRef = useRef(false);
  const autoplayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startAutoplay = useCallback(() => {
    if (autoplayTimerRef.current) {
      clearInterval(autoplayTimerRef.current);
    }
    if (!items || items.length <= 1) return;

    autoplayTimerRef.current = setInterval(() => {
      if (isInteractingRef.current || !flatListRef.current) return;
      const nextIndex = (currentIndexRef.current + 1) % items.length;
      currentIndexRef.current = nextIndex;
      flatListRef.current.scrollToOffset({
        offset: nextIndex * SCREEN_WIDTH,
        animated: true,
      });
    }, AUTOPLAY_INTERVAL_MS);
  }, [items]);

  const pauseAutoplay = useCallback(() => {
    if (autoplayTimerRef.current) {
      clearInterval(autoplayTimerRef.current);
      autoplayTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    startAutoplay();
    return () => {
      pauseAutoplay();
    };
  }, [startAutoplay, pauseAutoplay]);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleScrollBeginDrag = () => {
    isInteractingRef.current = true;
    pauseAutoplay();
  };

  const handleMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(offsetX / SCREEN_WIDTH);
    currentIndexRef.current = newIdx;
    isInteractingRef.current = false;
    startAutoplay();
  };

  const handleScrollEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newIdx = Math.round(offsetX / SCREEN_WIDTH);
    currentIndexRef.current = newIdx;
    isInteractingRef.current = false;
    startAutoplay();
  };

  if (!items || items.length === 0) return null;

  return (
    <View style={styles.heroBannerContainer}>
      <Animated.FlatList
        ref={flatListRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(item) => `hero-${item.id}`}
        onScroll={scrollHandler}
        onScrollBeginDrag={handleScrollBeginDrag}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
        renderItem={({ item, index }) => (
          <HeroSlideItem
            item={item}
            index={index}
            scrollX={scrollX}
            onPress={() => onPressItem(item)}
          />
        )}
      />

      <View style={styles.heroDotsOverlay}>
        {items.map((_, idx) => (
          <MorphingPaginationDot
            key={`morph-dot-${idx}`}
            index={idx}
            scrollX={scrollX}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBannerContainer: {
    width: SCREEN_WIDTH,
    height: HERO_BANNER_HEIGHT,
    position: 'relative',
    marginBottom: 20,
    backgroundColor: '#16161A',
  },
  heroSlide: {
    width: SCREEN_WIDTH,
    height: HERO_BANNER_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
  },
  imageOverflowWrap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  imageContainer: {
    width: SCREEN_WIDTH * 1.24,
    height: '100%',
    marginLeft: -SCREEN_WIDTH * 0.12,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroContentOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  heroUrgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
  },
  heroUrgentText: {
    color: '#09090B',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  heroCityBadge: {
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroCityText: {
    color: '#FAFAFA',
    fontSize: 10,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FAFAFA',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroDotsOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroDot: {
    height: 4,
    borderRadius: 2,
  },
});
