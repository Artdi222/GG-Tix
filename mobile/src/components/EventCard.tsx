import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_COLORS } from '../constants/config';

export interface EventItem {
  id: string;
  title: string;
  publisherName?: string;
  dateTime: string;
  endDateTime?: string | null;
  description?: string;
  imageUrl?: string | null;
  status: 'open' | 'closed';
  artist?: {
    id: string;
    name: string;
    photoUrl?: string | null;
  } | null;
  venue?: {
    id: string;
    name: string;
    city: string;
    address: string;
  } | null;
}

interface EventCardProps {
  event: EventItem;
  onPress: () => void;
}

export function EventCard({ event, onPress }: EventCardProps) {
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const imageSource = event.imageUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80';

  return (
    <TouchableOpacity activeOpacity={0.88} style={styles.card} onPress={onPress}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: imageSource }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <View style={styles.dateBadge}>
          <Text style={styles.dateBadgeText}>{formatDate(event.dateTime)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        {event.artist && (
          <View style={styles.artistRow}>
            <Ionicons name="mic-outline" size={14} color={BRAND_COLORS.accent} />
            <Text style={styles.artistName} numberOfLines={1}>
              {event.artist.name}
            </Text>
          </View>
        )}

        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.footerRow}>
          <View style={styles.venueContainer}>
            <Ionicons name="location-sharp" size={14} color={BRAND_COLORS.muted} />
            <Text style={styles.venueText} numberOfLines={1}>
              {event.venue ? `${event.venue.name}, ${event.venue.city}` : 'Venue TBA'}
            </Text>
          </View>

          <View style={styles.arrowButton}>
            <Ionicons name="arrow-forward" size={16} color={BRAND_COLORS.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  imageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    backgroundColor: '#20173A',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dateBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(27, 19, 48, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(242, 169, 59, 0.4)',
  },
  dateBadgeText: {
    color: BRAND_COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  artistName: {
    color: BRAND_COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 24,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  venueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 12,
  },
  venueText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 13,
  },
  arrowButton: {
    backgroundColor: BRAND_COLORS.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
