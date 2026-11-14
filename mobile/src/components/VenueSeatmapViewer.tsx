import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BRAND_COLORS } from '../constants/config';
import { TicketCategoryItem } from './CategoryCard';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEFAULT_VENUE_SEATMAP =
  'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1200&auto=format&fit=crop&q=80';

interface VenueSeatmapViewerProps {
  seatmapUrl?: string | null;
  eventTitle?: string;
  venueName?: string;
  ticketCategories?: TicketCategoryItem[];
  selectedCategory?: TicketCategoryItem | null;
  onSelectCategory?: (cat: TicketCategoryItem) => void;
}

export function VenueSeatmapViewer({
  seatmapUrl,
  eventTitle,
  venueName,
  ticketCategories = [],
  selectedCategory,
  onSelectCategory,
}: VenueSeatmapViewerProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const imageUrl = seatmapUrl && seatmapUrl.trim().startsWith('http')
    ? seatmapUrl.trim()
    : DEFAULT_VENUE_SEATMAP;


  const getCategoryPositionDescription = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes('vip') || lower.includes('vvip')) {
      return 'Area Depan Panggung • Akses Dekat Stage';
    }
    if (lower.includes('cat 1') || lower.includes('kategori 1')) {
      return 'Tribun Bawah Sayap Kiri & Kanan';
    }
    if (lower.includes('cat 2') || lower.includes('kategori 2')) {
      return 'Tribun Tengah Bertingkat';
    }
    if (lower.includes('cat 3') || lower.includes('kategori 3')) {
      return 'Tribun Atas / Balkon';
    }
    if (lower.includes('fest') || lower.includes('standing')) {
      return 'Festival Standing • Area Berdiri';
    }
    return 'Sesuai Denah Resmi Promotor';
  };

  const getCategoryColor = (name: string, index: number): string => {
    const lower = name.toLowerCase();
    if (lower.includes('vip')) return BRAND_COLORS.zoneVip;
    if (lower.includes('cat 1') || lower.includes('kategori 1')) return BRAND_COLORS.zoneCat1;
    if (lower.includes('cat 2') || lower.includes('kategori 2')) return BRAND_COLORS.zoneCat2;
    if (lower.includes('cat 3') || lower.includes('kategori 3')) return BRAND_COLORS.zoneCat3;
    if (lower.includes('fest') || lower.includes('standing')) return BRAND_COLORS.zoneFestival;

    const fallbackColors = [
      BRAND_COLORS.zoneVip,
      BRAND_COLORS.zoneCat1,
      BRAND_COLORS.zoneCat2,
      BRAND_COLORS.zoneCat3,
      BRAND_COLORS.zoneFestival,
    ];
    return fallbackColors[index % fallbackColors.length];
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleWithBadge}>
          <Ionicons name="map-outline" size={18} color={BRAND_COLORS.accent} />
          <Text style={styles.sectionTitle}>Denah & Tata Letak Kursi</Text>
        </View>
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Perbesar denah tempat duduk"
        >
          <Ionicons name="expand-outline" size={14} color={BRAND_COLORS.accent} />
          <Text style={styles.expandButtonText}>Perbesar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.stageAnchor}>
        <View style={styles.stageGlowLine} />
        <View style={styles.stagePill}>
          <Ionicons name="sparkles" size={11} color="#FFFFFF" />
          <Text style={styles.stageText}>STAGE / PANGGUNG UTAMA</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.mapCard}
        activeOpacity={0.92}
        onPress={() => setModalVisible(true)}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.mapImage}
          contentFit="cover"
          transition={250}
        />

        <View style={styles.overlayBar}>
          <View style={styles.helperTag}>
            <Ionicons name="finger-print-outline" size={13} color="#18181B" />
            <Text style={styles.helperText}>Ketuk untuk perbesar & lihat detail zona</Text>
          </View>
          <View style={styles.zoomBadge}>
            <Ionicons name="search" size={13} color="#18181B" />
          </View>
        </View>
      </TouchableOpacity>

      {selectedCategory && (
        <View style={styles.selectedPositionCard}>
          <View style={styles.positionHeaderRow}>
            <View style={styles.positionDot} />
            <Text style={styles.positionTitle}>
              Posisi Duduk: {selectedCategory.name}
            </Text>
          </View>
          <Text style={styles.positionDescription}>
            📍 {getCategoryPositionDescription(selectedCategory.name)}
          </Text>
        </View>
      )}

      {ticketCategories.length > 0 && (
        <View style={styles.legendContainer}>
          <Text style={styles.legendHeader}>Keterangan Zona Panggung:</Text>
          <View style={styles.legendWrap}>
            {ticketCategories.map((cat, idx) => {
              const color = getCategoryColor(cat.name, idx);
              const isSelected = selectedCategory?.id === cat.id;

              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.legendChip,
                    isSelected && { borderColor: color, backgroundColor: 'rgba(24, 24, 27,0.06)' },
                  ]}
                  onPress={() => onSelectCategory && onSelectCategory(cat)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.colorIndicator, { backgroundColor: color }]} />
                  <Text
                    style={[
                      styles.legendName,
                      isSelected && { color: BRAND_COLORS.textLight, fontWeight: '700' },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      <Modal
        visible={modalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <StatusBar barStyle="dark-content" backgroundColor="#F6F6F8" />

          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Tutup denah"
            >
              <Ionicons name="close" size={20} color="#18181B" />
            </TouchableOpacity>

            <View style={styles.modalTitleWrap}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                {eventTitle || 'Tata Letak Tempat Duduk Konser'}
              </Text>
              <Text style={styles.modalSub}>{venueName || 'Denah Resmi Promotor'}</Text>
            </View>

            <View style={{ width: 40 }} />
          </View>

          <View style={styles.modalStageAnchor}>
            <View style={styles.stagePill}>
              <Ionicons name="sparkles" size={11} color="#FFFFFF" />
              <Text style={styles.stageText}>STAGE / PANGGUNG UTAMA</Text>
            </View>
          </View>

          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            maximumZoomScale={4.0}
            minimumZoomScale={1.0}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            centerContent
          >
            <Image
              source={{ uri: imageUrl }}
              style={styles.modalImage}
              contentFit="contain"
              transition={200}
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <View style={styles.zoomHintRow}>
              <Ionicons name="information-circle-outline" size={14} color={BRAND_COLORS.accent} />
              <Text style={styles.zoomHintText}>
                Gunakan dua jari (pinch-to-zoom) untuk memperbesar denah kursi
              </Text>
            </View>

            {ticketCategories.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.modalCategoryList}
              >
                {ticketCategories.map((cat, idx) => {
                  const color = getCategoryColor(cat.name, idx);
                  const isSelected = selectedCategory?.id === cat.id;

                  return (
                    <TouchableOpacity
                      key={`modal-${cat.id}`}
                      style={[
                        styles.modalCatChip,
                        isSelected && { borderColor: color, backgroundColor: 'rgba(24, 24, 27,0.1)' },
                      ]}
                      onPress={() => {
                        if (onSelectCategory) onSelectCategory(cat);
                      }}
                    >
                      <View style={[styles.colorIndicator, { backgroundColor: color }]} />
                      <Text
                        style={[
                          styles.modalCatName,
                          isSelected && { color: '#FFFFFF', fontWeight: '800' },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalConfirmBtnText}>Tutup & Lanjut Pilih Tiket</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#18181B',
    letterSpacing: -0.2,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 165, 36, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 165, 36, 0.25)',
  },
  expandButtonText: {
    color: BRAND_COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },


  stageAnchor: {
    alignItems: 'center',
    marginBottom: 10,
  },
  stageGlowLine: {
    width: '60%',
    height: 3,
    backgroundColor: BRAND_COLORS.accent,
    borderRadius: 2,
    marginBottom: 4,
    shadowColor: BRAND_COLORS.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
  stagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
  },
  stageText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },


  mapCard: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F6F6F8',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  mapImage: {
    width: '100%',
    height: '100%',
  },
  overlayBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(24, 24, 27, 0.08)',
  },
  helperTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  helperText: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '500',
  },
  zoomBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E4E4E7',
    justifyContent: 'center',
    alignItems: 'center',
  },


  selectedPositionCard: {
    marginTop: 12,
    backgroundColor: '#F4F4F5',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 165, 36, 0.3)',
  },
  positionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  positionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND_COLORS.accent,
  },
  positionTitle: {
    color: BRAND_COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
  },
  positionDescription: {
    color: '#3F3F46',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },


  legendContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
  },
  legendHeader: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  legendWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  legendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  colorIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendName: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '600',
  },


  modalContainer: {
    flex: 1,
    backgroundColor: '#F6F6F8',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 54,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  modalCloseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F4F4F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  modalTitle: {
    color: '#18181B',
    fontSize: 15,
    fontWeight: '800',
  },
  modalSub: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  modalStageAnchor: {
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  modalScrollView: {
    flex: 1,
    backgroundColor: '#F6F6F8',
  },
  modalScrollContent: {
    minHeight: SCREEN_HEIGHT * 0.55,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_HEIGHT * 0.5,
  },
  modalFooter: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E4E4E7',
  },
  zoomHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  zoomHintText: {
    color: '#52525B',
    fontSize: 12,
    fontWeight: '500',
  },
  modalCategoryList: {
    gap: 8,
    paddingBottom: 14,
  },
  modalCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  modalCatName: {
    color: '#52525B',
    fontSize: 12,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
