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
import { EventItem, formatEventDate, getPosterImage } from './EventCard';
import { LinearGradient } from './LinearGradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_BANNER_HEIGHT = Math.round(SCREEN_WIDTH * (10 / 16));
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

      {/* Scrim keeps the title readable on bright, busy concert photos. */}
      <LinearGradient
        colors={['rgba(9,9,11,0)', 'rgba(9,9,11,0.55)', 'rgba(9,9,11,0.95)']}
        locations={[0, 0.5, 1]}
        style={styles.heroScrim}
        pointerEvents="none"
      />

      <View style={styles.heroContentOverlay}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroUrgentBadge}>
            <Ionicons name="sparkles" size={11} color="#FFFFFF" />
            <Text style={styles.heroUrgentText}>POPULER</Text>
          </View>
          {item.venue?.city && (
            <View style={styles.heroCityBadge}>
              <Text style={styles.heroCityText}>📍 {item.venue.city}</Text>
            </View>
          )}
        </View>

        <Text style={styles.heroTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.heroMeta} numberOfLines={1}>
          {[formatEventDate(item.dateTime).full, item.artist?.name].filter(Boolean).join(' · ')}
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
      backgroundColor: opacity > 0.6 ? BRAND_COLORS.accent : '#18181B',
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
    backgroundColor: '#FFFFFF',
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
  heroScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '70%',
  },
  heroContentOverlay: {
    position: 'absolute',
    bottom: 22,
    left: 16,
    right: 16,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
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
    color: '#FFFFFF',
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
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroCityText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroMeta: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  heroDotsOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroDot: {
    height: 4,
    borderRadius: 2,
  },
});
