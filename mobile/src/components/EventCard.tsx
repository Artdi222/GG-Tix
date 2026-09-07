import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MOTION_TOKENS } from '../constants/motion';

export interface EventItem {
  id: string;
  title: string;
  publisherName?: string;
  description?: string | null;
  dateTime: string;
  endDateTime?: string | null;
  seatmapUrl?: string | null;
  imageUrl?: string | null;
  maxTicketsPerOrder?: number;
  tags?: string[];
  status: 'open' | 'closed';
  artist?: {
    id: string;
    name: string;
    bio?: string | null;
    photoUrl?: string | null;
  } | null;
  venue?: {
    id: string;
    name: string;
    city: string;
    address?: string;
  } | null;
  ticketCategories?: {
    id: string;
    name: string;
    price: string | number;
    quotaRemaining?: number;
    quotaTotal?: number;
  }[];
}

interface EventCardProps {
  event: EventItem;
  variant?: 'portrait' | 'row';
  style?: ViewStyle;
}

const FALLBACK_POSTERS = [
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800&auto=format&fit=crop&q=80',
];

export function getPosterImage(event: EventItem): string {
  if (event.imageUrl && event.imageUrl.trim().startsWith('http')) {
    return event.imageUrl.trim();
  }
  const index = Math.abs(event.title.length) % FALLBACK_POSTERS.length;
  return FALLBACK_POSTERS[index];
}

export function formatRupiah(val?: string | number | null): string {
  if (val === undefined || val === null || val === '') return 'Cek Tiket';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return 'Gratis';
  return `Rp ${num.toLocaleString('id-ID')}`;
}

export function formatEventDate(isoString?: string): { day: string; month: string; time: string; full: string; weekday: string } {
  if (!isoString) return { day: '-', month: '-', time: '', full: '-', weekday: '-' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { day: '-', month: '-', time: '', full: '-', weekday: '-' };

    const day = d.toLocaleDateString('id-ID', { day: '2-digit' });
    const month = d.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase();
    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const weekday = d.toLocaleDateString('id-ID', { weekday: 'short' }).toUpperCase();
    const full = d.toLocaleDateString('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return { day, month, time, full, weekday };
  } catch {
    return { day: '-', month: '-', time: '', full: '-', weekday: '-' };
  }
}

export function getLowestPrice(event: EventItem): string {
  if (!event.ticketCategories || event.ticketCategories.length === 0) {
    return 'Cek Tiket';
  }
  const prices = event.ticketCategories
    .map((c) => (typeof c.price === 'string' ? parseFloat(c.price) : c.price))
    .filter((p) => !isNaN(p) && p > 0);

  if (prices.length === 0) return 'Gratis';
  const minPrice = Math.min(...prices);
  return formatRupiah(minPrice);
}

export function EventCard({ event, variant = 'portrait', style }: EventCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(MOTION_TOKENS.pressScale.card, MOTION_TOKENS.springSnappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, MOTION_TOKENS.springSnappy);
  };

  const dateInfo = formatEventDate(event.dateTime);
  const lowestPrice = getLowestPrice(event);
  const posterUri = imageError ? FALLBACK_POSTERS[0] : getPosterImage(event);

  const isSoldOut =
    event.ticketCategories &&
    event.ticketCategories.length > 0 &&
    event.ticketCategories.every(
      (c) => c.quotaRemaining !== undefined && Number(c.quotaRemaining) <= 0
    );

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        
      }
    }
    router.push(`/event/${event.id}`);
  };

  if (variant === 'portrait') {
    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePress}
          style={[styles.portraitContainer, style]}
          accessibilityRole="button"
          accessibilityLabel={`Konser ${event.title}`}
        >
          <View style={styles.portraitPosterWrapper}>
            <Image
              source={{ uri: posterUri }}
              style={styles.portraitPosterImage}
              contentFit="cover"
              transition={200}
              onError={() => setImageError(true)}
            />

            <View style={[styles.portraitBadge, isSoldOut ? styles.badgeSold : styles.badgeAvail]}>
              <Text style={[styles.portraitBadgeText, isSoldOut ? styles.badgeTextSold : styles.badgeTextAvail]}>
                {isSoldOut ? 'HABIS' : 'TERSEDIA'}
              </Text>
            </View>

            <View style={styles.posterDateTag}>
              <Text style={styles.posterDateText}>{dateInfo.day} {dateInfo.month}</Text>
            </View>
          </View>

          <View style={styles.portraitInfo}>
            <Text style={styles.portraitTitle} numberOfLines={2}>
              {event.title}
            </Text>

            {event.artist?.name ? (
              <Text style={styles.portraitArtist} numberOfLines={1}>
                {event.artist.name}
              </Text>
            ) : null}

            <View style={styles.portraitBottomRow}>
              <Text style={styles.portraitPrice}>{lowestPrice}</Text>
              <View style={styles.portraitBuyPill}>
                <Text style={styles.portraitBuyPillText}>Beli</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[styles.rowContainer, style]}
        accessibilityRole="button"
        accessibilityLabel={`Konser ${event.title}`}
      >
        <View style={styles.rowPosterWrapper}>
          <Image
            source={{ uri: posterUri }}
            style={styles.rowPosterImage}
            contentFit="cover"
            transition={200}
            onError={() => setImageError(true)}
          />

          {isSoldOut && (
            <View style={styles.rowSoldOverlay}>
              <Text style={styles.rowSoldText}>HABIS</Text>
            </View>
          )}
        </View>

        <View style={styles.rowContent}>
          <View style={styles.rowHeader}>
            <View style={styles.rowDatePill}>
              <Ionicons name="calendar-outline" size={11} color="#F59E0B" />
              <Text style={styles.rowDateText}>{dateInfo.full}</Text>
            </View>
            {event.venue?.city ? (
              <View style={styles.cityLocationRow}>
                <Ionicons name="location-outline" size={11} color="#71717A" />
                <Text style={styles.rowCityText}>{event.venue.city}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.rowTitle} numberOfLines={2}>
            {event.title}
          </Text>

          {event.artist?.name ? (
            <View style={styles.rowArtistRow}>
              <Ionicons name="mic-outline" size={12} color="#A1A1AA" />
              <Text style={styles.rowArtistText} numberOfLines={1}>
                {event.artist.name}
              </Text>
            </View>
          ) : null}

          {event.venue?.name ? (
            <Text style={styles.rowVenueText} numberOfLines={1}>
              {event.venue.name}
            </Text>
          ) : null}

          <View style={styles.rowBottom}>
            <View>
              <Text style={styles.pricePrefix}>Mulai dari</Text>
              <Text style={styles.rowPrice}>{lowestPrice}</Text>
            </View>

            <View style={[styles.actionButton, isSoldOut && styles.actionButtonSold]}>
              <Text style={[styles.actionButtonText, isSoldOut && styles.actionButtonTextSold]}>
                {isSoldOut ? 'Habis' : 'Pilih Kursi'}
              </Text>
              {!isSoldOut && <Ionicons name="chevron-forward" size={12} color="#09090B" />}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  portraitContainer: {
    width: 148,
    backgroundColor: '#16161A',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  portraitPosterWrapper: {
    width: '100%',
    height: 196,
    position: 'relative',
    backgroundColor: '#111114',
  },
  portraitPosterImage: {
    width: '100%',
    height: '100%',
  },
  portraitBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeAvail: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
  },
  badgeSold: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
  },
  portraitBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  badgeTextAvail: {
    color: '#FFFFFF',
  },
  badgeTextSold: {
    color: '#FFFFFF',
  },
  posterDateTag: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  posterDateText: {
    color: '#FAFAFA',
    fontSize: 10,
    fontWeight: '700',
  },
  portraitInfo: {
    padding: 10,
  },
  portraitTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FAFAFA',
    lineHeight: 17,
    marginBottom: 4,
  },
  portraitArtist: {
    fontSize: 11,
    color: '#A1A1AA',
    marginBottom: 8,
  },
  portraitBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  portraitPrice: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
  },
  portraitBuyPill: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  portraitBuyPillText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
  },

  rowContainer: {
    flexDirection: 'row',
    backgroundColor: '#16161A',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#27272A',
    marginBottom: 12,
  },
  rowPosterWrapper: {
    width: 105,
    height: 145,
    position: 'relative',
    backgroundColor: '#111114',
  },
  rowPosterImage: {
    width: '100%',
    height: '100%',
  },
  rowSoldOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(9, 9, 11, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowSoldText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  rowContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  rowDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowDateText: {
    fontSize: 11,
    color: '#F59E0B',
    fontWeight: '700',
  },
  cityLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  rowCityText: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FAFAFA',
    lineHeight: 18,
    marginBottom: 2,
  },
  rowArtistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  rowArtistText: {
    fontSize: 11,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  rowVenueText: {
    fontSize: 11,
    color: '#71717A',
    marginBottom: 6,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  pricePrefix: {
    fontSize: 9,
    color: '#71717A',
    fontWeight: '500',
  },
  rowPrice: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F59E0B',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  actionButtonSold: {
    backgroundColor: '#27272A',
  },
  actionButtonText: {
    color: '#09090B',
    fontSize: 11,
    fontWeight: '800',
  },
  actionButtonTextSold: {
    color: '#71717A',
  },
});
