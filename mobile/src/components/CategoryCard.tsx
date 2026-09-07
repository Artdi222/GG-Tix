import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BRAND_COLORS } from '../constants/config';
import { MOTION_TOKENS } from '../constants/motion';

export interface TicketCategoryItem {
  id: string;
  name: string;
  price: string | number;
  quotaTotal: number;
  quotaRemaining: number;
  benefits?: string[] | null;
  sortOrder?: number;
}

interface CategoryCardProps {
  category: TicketCategoryItem;
  isSelected: boolean;
  onSelect: (cat: TicketCategoryItem) => void;
}

export function CategoryCard({ category, isSelected, onSelect }: CategoryCardProps) {
  const isSoldOut = Number(category.quotaRemaining) <= 0;
  const numPrice = typeof category.price === 'string' ? parseFloat(category.price) : category.price;

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!isSoldOut) {
      scale.value = withSpring(MOTION_TOKENS.pressScale.card, MOTION_TOKENS.springSnappy);
    }
  };

  const handlePressOut = () => {
    if (!isSoldOut) {
      scale.value = withSpring(1, MOTION_TOKENS.springSnappy);
    }
  };

  const handlePress = () => {
    if (isSoldOut) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        
      }
    }
    onSelect(category);
  };

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(numPrice || 0);

  const quotaPercent = category.quotaTotal > 0
    ? Math.max(0, Math.min(100, Math.round((Number(category.quotaRemaining) / Number(category.quotaTotal)) * 100)))
    : 0;

  const quotaColor = isSoldOut
    ? BRAND_COLORS.danger
    : quotaPercent < 20
    ? BRAND_COLORS.warning
    : BRAND_COLORS.success;

  const getZoneTag = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('vip') || lower.includes('vvip')) {
      return { label: 'Zona VIP Panggung', color: BRAND_COLORS.zoneVip };
    }
    if (lower.includes('cat 1') || lower.includes('kategori 1')) {
      return { label: 'Tribun Bawah', color: BRAND_COLORS.zoneCat1 };
    }
    if (lower.includes('cat 2') || lower.includes('kategori 2')) {
      return { label: 'Tribun Tengah', color: BRAND_COLORS.zoneCat2 };
    }
    if (lower.includes('cat 3') || lower.includes('kategori 3')) {
      return { label: 'Balkon Atas', color: BRAND_COLORS.zoneCat3 };
    }
    if (lower.includes('fest') || lower.includes('standing')) {
      return { label: 'Festival Standing', color: BRAND_COLORS.zoneFestival };
    }
    return { label: 'Numbered Seating', color: BRAND_COLORS.accent };
  };

  const zoneTag = getZoneTag(category.name);

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        style={[
          styles.card,
          isSelected && styles.cardSelected,
          isSoldOut && styles.cardSoldOut,
        ]}
        disabled={isSoldOut}
        accessibilityRole="button"
        accessibilityLabel={`Kategori ${category.name}, Harga ${formattedPrice}`}
      >
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <View style={[styles.zoneBadge, { borderColor: `${zoneTag.color}55` }]}>
              <View style={[styles.zoneDot, { backgroundColor: zoneTag.color }]} />
              <Text style={[styles.zoneText, { color: zoneTag.color }]}>{zoneTag.label}</Text>
            </View>

            <Text style={styles.name}>{category.name}</Text>
            <Text style={styles.price}>{formattedPrice}</Text>
          </View>

          <View style={styles.indicatorContainer}>
            {isSoldOut ? (
              <View style={styles.soldOutBadge}>
                <Text style={styles.soldOutText}>Habis</Text>
              </View>
            ) : (
              <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                {isSelected && <View style={styles.radioInner} />}
              </View>
            )}
          </View>
        </View>

        <View style={styles.quotaSection}>
          <View style={styles.quotaRow}>
            <Text style={styles.quotaText}>
              Sisa Kuota:{' '}
              <Text style={{ color: quotaColor, fontWeight: '700' }}>
                {category.quotaRemaining}
              </Text>{' '}
              / {category.quotaTotal} tiket
            </Text>
            <Text style={[styles.percentText, { color: quotaColor }]}>
              {isSoldOut ? '0%' : `${quotaPercent}%`}
            </Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${quotaPercent}%`, backgroundColor: quotaColor },
              ]}
            />
          </View>
        </View>

        {category.benefits && category.benefits.length > 0 && (
          <View style={styles.benefitsContainer}>
            {category.benefits.map((b, idx) => (
              <View key={idx} style={styles.benefitRow}>
                <Ionicons name="checkmark-circle" size={14} color={BRAND_COLORS.success} />
                <Text style={styles.benefitText}>{b}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#27272A',
  },
  cardSelected: {
    borderColor: BRAND_COLORS.accent,
    backgroundColor: '#1F1F24',
    shadowColor: BRAND_COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  cardSoldOut: {
    opacity: 0.45,
    backgroundColor: '#111114',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
  },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#1A1A20',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  zoneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  zoneText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAFAFA',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  indicatorContainer: {
    marginLeft: 12,
    paddingTop: 4,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#71717A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioCircleSelected: {
    borderColor: BRAND_COLORS.accent,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BRAND_COLORS.accent,
  },
  soldOutBadge: {
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  soldOutText: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
  },
  quotaSection: {
    marginTop: 12,
  },
  quotaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  quotaText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontVariant: ['tabular-nums'],
  },
  percentText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: '#27272A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  benefitsContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    gap: 6,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitText: {
    fontSize: 12,
    color: '#D4D4D8',
    flex: 1,
  },
});
