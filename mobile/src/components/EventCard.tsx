import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
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
  /** List endpoint only: totals and starting price across categories. */
  capacity?: number;
  sold?: number;
  minPrice?: number | null;
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
  variant?: 'portrait' | 'row' | 'poster';
  /** Poster variant: ranking number shown in the corner. */
  rank?: number;
  /** Poster variant: card width (height follows a 2:3 poster). */
  width?: number;
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
  // Hash the id so neighbouring events don't all land on the same stock photo.
  let hash = 0;
  for (const ch of event.id ?? event.title) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return FALLBACK_POSTERS[Math.abs(hash) % FALLBACK_POSTERS.length];
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

    const day = d.toLocaleDateString('id-ID', { day: '2-digit', timeZone: 'Asia/Jakarta' });
    const month = d.toLocaleDateString('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' }).toUpperCase();
    const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    const weekday = d.toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'Asia/Jakarta' }).toUpperCase();
    const full = d.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
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

/** True once the show has ended (or started, when no end time is set). */
export function isEventOver(event: Pick<EventItem, 'dateTime' | 'endDateTime'>, now = Date.now()): boolean {
  const end = new Date(event.endDateTime || event.dateTime).getTime();
  return Number.isFinite(end) && end < now;
}

export function getLowestPrice(event: EventItem): string {
  if (!event.ticketCategories || event.ticketCategories.length === 0) {
    return event.minPrice != null ? formatRupiah(event.minPrice) : 'Cek Tiket';
  }
  const prices = event.ticketCategories
    .map((c) => (typeof c.price === 'string' ? parseFloat(c.price) : c.price))
    .filter((p) => !isNaN(p) && p > 0);

  if (prices.length === 0) return 'Gratis';
  const minPrice = Math.min(...prices);
  return formatRupiah(minPrice);
}

export function EventCard({ event, variant = 'portrait', style, rank, width = 168 }: EventCardProps) {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const dateInfo = formatEventDate(event.dateTime);
  const lowestPrice = getLowestPrice(event);
  const posterUri = imageError ? FALLBACK_POSTERS[0] : getPosterImage(event);
  const isSoldOut =
    (event.capacity !== undefined && event.capacity > 0 && (event.sold ?? 0) >= event.capacity) ||
    (!!event.ticketCategories?.length &&
      event.ticketCategories.every((c) => c.quotaRemaining !== undefined && Number(c.quotaRemaining) <= 0));
  // Only flag scarcity when it is real: under 15% of capacity left.
  const fewLeft = !isSoldOut && !!event.capacity && (event.capacity - (event.sold ?? 0)) / event.capacity < 0.15;

  const pressIn = () => scale.set(withSpring(MOTION_TOKENS.pressScale.card, MOTION_TOKENS.springSnappy));
  const pressOut = () => scale.set(withSpring(1, MOTION_TOKENS.springSnappy));
  const open = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    router.push(`/event/${event.id}`);
  };
  const label = `${event.title}, ${dateInfo.full}${event.venue?.city ? `, ${event.venue.city}` : ''}, ${isSoldOut ? 'habis' : `mulai ${lowestPrice}`}`;

  if (variant === 'poster') {
    return (
      <Animated.View style={[animatedStyle, { width }]}>
        <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={open} style={style} accessibilityRole="button" accessibilityLabel={label}>
          <View style={[styles.poster, { width, height: Math.round(width * 1.5) }]}>
            <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} onError={() => setImageError(true)} />
            {rank ? (
              <View style={styles.rank}>
                <Text style={styles.rankText}>{rank}</Text>
              </View>
            ) : null}
            {isSoldOut || fewLeft ? (
              <View style={[styles.cornerFlag, isSoldOut ? styles.flagSold : styles.flagFew]}>
                <Text style={[styles.flagText, isSoldOut && { color: '#FFFFFF' }]}>{isSoldOut ? 'Habis' : 'Hampir habis'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.posterTitle} numberOfLines={2}>{event.title}</Text>
          {/* Plain lines read better than a boxed "date | price" pill that truncates on narrow cards. */}
          <Text style={styles.posterMeta} numberOfLines={1}>
            {dateInfo.weekday.charAt(0) + dateInfo.weekday.slice(1).toLowerCase()}, {dateInfo.day} {dateInfo.month.charAt(0) + dateInfo.month.slice(1).toLowerCase()}
            {event.venue?.city ? ` · ${event.venue.city}` : ''}
          </Text>
          <Text style={[styles.posterPrice, isSoldOut && styles.priceSold]} numberOfLines={1}>
            {isSoldOut ? 'Tiket habis' : `Mulai ${lowestPrice}`}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === 'portrait') {
    return (
      <Animated.View style={animatedStyle}>
        <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={open} style={[styles.portrait, style]} accessibilityRole="button" accessibilityLabel={label}>
          <View style={styles.portraitPoster}>
            <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} onError={() => setImageError(true)} />
            <View style={styles.dateChip}>
              <Text style={styles.dateChipDay}>{dateInfo.day}</Text>
              <Text style={styles.dateChipMonth}>{dateInfo.month}</Text>
            </View>
            {isSoldOut || fewLeft ? (
              <View style={[styles.flag, isSoldOut ? styles.flagSold : styles.flagFew]}>
                <Text style={styles.flagText}>{isSoldOut ? 'Habis' : 'Hampir habis'}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.portraitTitle} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>{event.venue?.city || event.artist?.name || ''}</Text>
          <Text style={[styles.price, isSoldOut && styles.priceSold]} numberOfLines={1}>{isSoldOut ? 'Tiket habis' : lowestPrice}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={animatedStyle}>
      <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={open} style={[styles.row, style]} accessibilityRole="button" accessibilityLabel={label}>
        <View style={styles.rowPoster}>
          <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} onError={() => setImageError(true)} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowDate} numberOfLines={1}>
            {dateInfo.weekday}, {dateInfo.day} {dateInfo.month} · {dateInfo.time}
          </Text>
          <Text style={styles.rowTitle} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[event.venue?.name, event.venue?.city].filter(Boolean).join(', ')}
          </Text>
          <View style={styles.rowFoot}>
            <Text style={[styles.price, isSoldOut && styles.priceSold]} numberOfLines={1}>
              {isSoldOut ? 'Tiket habis' : `Mulai ${lowestPrice}`}
            </Text>
            {fewLeft ? <Text style={styles.fewText}>Hampir habis</Text> : null}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  poster: { borderRadius: 14, overflow: 'hidden', backgroundColor: '#E4E4E7', marginBottom: 10 },
  rank: { position: 'absolute', top: 0, left: 0, minWidth: 40, height: 44, paddingHorizontal: 10, borderBottomRightRadius: 14, backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center' },
  rankText: { color: '#F5A524', fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  cornerFlag: { position: 'absolute', top: 10, right: 10, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  posterTitle: { fontSize: 15, fontWeight: '800', color: '#18181B', lineHeight: 19, minHeight: 38 },
  posterMeta: { fontSize: 13, color: '#71717A', marginTop: 4 },
  posterPrice: { fontSize: 15, fontWeight: '800', color: '#18181B', marginTop: 2 },
  portrait: { width: 156 },
  portraitPoster: { width: 156, height: 208, borderRadius: 16, overflow: 'hidden', backgroundColor: '#E4E4E7', marginBottom: 10 },
  dateChip: { position: 'absolute', top: 10, left: 10, backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 40 },
  dateChipDay: { fontSize: 16, fontWeight: '800', color: '#18181B', lineHeight: 18 },
  dateChipMonth: { fontSize: 10, fontWeight: '700', color: '#B4630A', letterSpacing: 0.5 },
  flag: { position: 'absolute', bottom: 10, left: 10, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  flagSold: { backgroundColor: 'rgba(24,24,27,0.85)' },
  flagFew: { backgroundColor: '#F5A524' },
  flagText: { fontSize: 11, fontWeight: '700', color: '#18181B' },
  portraitTitle: { fontSize: 15, fontWeight: '700', color: '#18181B', lineHeight: 19, letterSpacing: -0.2 },
  meta: { fontSize: 13, color: '#71717A', marginTop: 2 },
  price: { fontSize: 14, fontWeight: '700', color: '#18181B', marginTop: 6 },
  priceSold: { color: '#A1A1AA' },

  row: { flexDirection: 'row', gap: 14, paddingVertical: 4 },
  rowPoster: { width: 88, height: 112, borderRadius: 14, overflow: 'hidden', backgroundColor: '#E4E4E7' },
  rowBody: { flex: 1, justifyContent: 'center' },
  rowDate: { fontSize: 12, fontWeight: '700', color: '#B4630A', letterSpacing: 0.2, marginBottom: 4 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: '#18181B', lineHeight: 20, letterSpacing: -0.2 },
  rowFoot: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fewText: { fontSize: 11, fontWeight: '700', color: '#92400E', backgroundColor: 'rgba(245,165,36,0.18)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 6, overflow: 'hidden' },
});
