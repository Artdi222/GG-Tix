import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_COLORS } from '../constants/config';

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

  const formattedPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(numPrice || 0);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[
        styles.card,
        isSelected && styles.cardSelected,
        isSoldOut && styles.cardSoldOut,
      ]}
      disabled={isSoldOut}
      onPress={() => onSelect(category)}
    >
      <View style={styles.header}>
        <View style={styles.titleContainer}>
          <Text style={styles.name}>{category.name}</Text>
          <Text style={styles.price}>{formattedPrice}</Text>
        </View>

        <View style={styles.indicatorContainer}>
          {isSoldOut ? (
            <View style={styles.soldOutBadge}>
              <Text style={styles.soldOutText}>Habis Terjual</Text>
            </View>
          ) : (
            <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
              {isSelected && <View style={styles.radioInner} />}
            </View>
          )}
        </View>
      </View>

      <View style={styles.quotaRow}>
        <Text style={styles.quotaText}>
          Sisa kuota: <Text style={{ color: isSoldOut ? BRAND_COLORS.danger : BRAND_COLORS.accent, fontWeight: '700' }}>
            {category.quotaRemaining}
          </Text> / {category.quotaTotal}
        </Text>
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
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardSelected: {
    borderColor: BRAND_COLORS.accent,
    backgroundColor: '#352857',
  },
  cardSoldOut: {
    opacity: 0.55,
    backgroundColor: '#201838',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
  },
  indicatorContainer: {
    marginLeft: 12,
  },
  soldOutBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BRAND_COLORS.danger,
  },
  soldOutText: {
    color: BRAND_COLORS.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BRAND_COLORS.muted,
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
  quotaRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  quotaText: {
    fontSize: 12,
    color: BRAND_COLORS.textMuted,
  },
  benefitsContainer: {
    marginTop: 10,
    gap: 6,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  benefitText: {
    fontSize: 12,
    color: BRAND_COLORS.textLight,
  },
});
