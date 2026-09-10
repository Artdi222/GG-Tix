import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';
import { MOTION_TOKENS } from '../../constants/motion';
import { useAuthStore } from '../../store/auth-store';
import { CategoryCard, TicketCategoryItem } from '../../components/CategoryCard';
import { getPosterImage } from '../../components/EventCard';
import { VenueSeatmapViewer } from '../../components/VenueSeatmapViewer';

export interface EventDetailData {
  id: string;
  title: string;
  publisherName?: string;
  description?: string | null;
  dateTime: string;
  endDateTime?: string | null;
  seatmapUrl?: string | null;
  imageUrl?: string | null;
  maxTicketsPerOrder?: number;
  maintenanceMode?: boolean;
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
    address: string;
  } | null;
  ticketCategories?: TicketCategoryItem[];
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [event, setEvent] = useState<EventDetailData | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [selectedCategory, setSelectedCategory] = useState<TicketCategoryItem | null>(null);
  const [quantity, setQuantity] = useState(1);

  const insets = useSafeAreaInsets();
  const router = useRouter();
  const token = useAuthStore((state) => state.token);

  const minusScale = useSharedValue(1);
  const plusScale = useSharedValue(1);
  const checkoutScale = useSharedValue(1);

  const minusAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: minusScale.value }],
  }));

  const plusAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: plusScale.value }],
  }));

  const checkoutAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkoutScale.value }],
  }));

  useEffect(() => {
    let isMounted = true;
    if (id) {
      apiFetch<any>(`/events/${id}`)
        .then((data) => {
          if (!isMounted) return;
          const eventData = data?.data || data;
          setEvent(eventData);

          if (eventData.ticketCategories && eventData.ticketCategories.length > 0) {
            const available = eventData.ticketCategories.find(
              (c: TicketCategoryItem) => Number(c.quotaRemaining) > 0
            );
            if (available) {
              setSelectedCategory(available);
            }
          }
        })
        .catch((error: any) => {
          if (!isMounted) return;
          Alert.alert('Error', error.message || 'Gagal memuat detail konser.');
        })
        .finally(() => {
          if (!isMounted) return;
          setLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  const maxAllowed = Math.min(
    event?.maxTicketsPerOrder || 4,
    selectedCategory ? Number(selectedCategory.quotaRemaining) : 4
  );

  const handleMinus = () => {
    if (quantity <= 1) return;
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        
      }
    }
    minusScale.set(withSpring(MOTION_TOKENS.pressScale.iconButton, MOTION_TOKENS.springBrisk, () => {
      minusScale.set(withSpring(1, MOTION_TOKENS.springBrisk));
    }));
    setQuantity((q) => Math.max(1, q - 1));
  };

  const handlePlus = () => {
    if (quantity >= maxAllowed) {
      if (Platform.OS !== 'web') {
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {
          
        }
      }
      return;
    }
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        
      }
    }
    plusScale.set(withSpring(MOTION_TOKENS.pressScale.iconButton, MOTION_TOKENS.springBrisk, () => {
      plusScale.set(withSpring(1, MOTION_TOKENS.springBrisk));
    }));
    setQuantity((q) => Math.min(maxAllowed, q + 1));
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        title: event.title,
        message: `Beli tiket konser ${event.title} di GG-Tix sekarang! 🎟️🔥`,
      });
    } catch {
      
    }
  };

  const handleCheckout = () => {
    if (event?.maintenanceMode) return;
    if (!selectedCategory) {
      Alert.alert('Peringatan', 'Silakan pilih kategori tiket terlebih dahulu.');
      return;
    }

    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {
        
      }
    }

    if (!token) {
      if (Platform.OS === 'web') {
        const toLogin = typeof window !== 'undefined' ? window.confirm('Silakan masuk atau daftar terlebih dahulu untuk membeli tiket.') : true;
        if (toLogin) router.push('/auth/login');
        return;
      }
      Alert.alert('Perlu Masuk', 'Silakan masuk atau daftar terlebih dahulu untuk membeli tiket.', [
        { text: 'Batal', style: 'cancel' },
        { text: 'Masuk', onPress: () => router.push('/auth/login') },
      ]);
      return;
    }

    router.push({
      pathname: '/checkout/[id]',
      params: {
        id: id as string,
        categoryId: selectedCategory.id,
        qty: quantity.toString(),
        price: selectedCategory.price.toString(),
        categoryName: selectedCategory.name,
      },
    });
  };

  const formatDate = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  if (loading || !event) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={BRAND_COLORS.accent} />
        <Text style={styles.loadingText}>Memuat detail konser & layout panggung...</Text>
      </View>
    );
  }

  const selectedPriceNum = selectedCategory
    ? typeof selectedCategory.price === 'string'
      ? parseFloat(selectedCategory.price)
      : selectedCategory.price
    : 0;

  const totalPrice = selectedPriceNum * quantity;

  const formattedTotalPrice = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(totalPrice);

  const posterUri = getPosterImage(event as any);

  return (
    <View style={styles.container}>
      <View style={[styles.topStickyHeader, { top: Math.max(insets.top, 16) }]}>
        <TouchableOpacity
          style={styles.circleIconBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color="#FAFAFA" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.circleIconBtn}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Bagikan event"
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={19} color="#FAFAFA" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.coverWrapper}>
          <Image
            source={{ uri: posterUri }}
            style={styles.coverImage}
            contentFit="cover"
            transition={200}
          />
        </View>

        <View style={styles.mainContent}>
          <View style={styles.topMetaRow}>
            {event.publisherName && (
              <View style={styles.publisherBadge}>
                <Ionicons name="shield-checkmark-outline" size={12} color={BRAND_COLORS.accent} />
                <Text style={styles.publisherText}>
                  OFFICIAL BY {event.publisherName.toUpperCase()}
                </Text>
              </View>
            )}

            <View style={styles.statusOpenBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusOpenText}>Tiket Tersedia</Text>
            </View>
          </View>

          <Text style={styles.title}>{event.title}</Text>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="calendar-outline" size={17} color={BRAND_COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Tanggal & Waktu Acara</Text>
                <Text style={styles.infoValue}>{formatDate(event.dateTime)} WIB</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="location-outline" size={17} color={BRAND_COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Lokasi Venue Konser</Text>
                <Text style={styles.infoValue}>
                  {event.venue ? `${event.venue.name}, ${event.venue.city}` : 'Venue TBA'}
                </Text>
                {event.venue?.address ? (
                  <Text style={styles.infoSub}>{event.venue.address}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {event.artist && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Lineup / Performer</Text>
              <View style={styles.artistCard}>
                <Image
                  source={{
                    uri:
                      event.artist.photoUrl ||
                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&auto=format&fit=crop&q=80',
                  }}
                  style={styles.artistPhoto}
                  contentFit="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.artistName}>{event.artist.name}</Text>
                  {event.artist.bio ? (
                    <Text style={styles.artistBio} numberOfLines={3}>
                      {event.artist.bio}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          )}

          <VenueSeatmapViewer
            seatmapUrl={event.seatmapUrl}
            eventTitle={event.title}
            venueName={event.venue ? `${event.venue.name}, ${event.venue.city}` : undefined}
            ticketCategories={event.ticketCategories || []}
            selectedCategory={selectedCategory}
            onSelectCategory={(cat) => {
              setSelectedCategory(cat);
              setQuantity(1);
            }}
          />

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Pilih Kategori Tiket</Text>
              <Text style={styles.categoryCount}>
                {event.ticketCategories?.length || 0} Pilihan
              </Text>
            </View>

            {event.ticketCategories && event.ticketCategories.length > 0 ? (
              event.ticketCategories.map((cat) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  isSelected={selectedCategory?.id === cat.id}
                  onSelect={(c) => {
                    setSelectedCategory(c);
                    setQuantity(1);
                  }}
                />
              ))
            ) : (
              <Text style={styles.emptyCategories}>Kategori tiket belum tersedia.</Text>
            )}
          </View>

          {selectedCategory && Number(selectedCategory.quotaRemaining) > 0 && (
            <View style={styles.stepperSection}>
              <View>
                <Text style={styles.stepperLabel}>Jumlah Tiket</Text>
                <Text style={styles.stepperSub}>Maksimal {maxAllowed} tiket per transaksi</Text>
              </View>

              <View style={styles.stepperRow}>
                <Animated.View style={minusAnimatedStyle}>
                  <TouchableOpacity
                    style={[styles.stepBtn, quantity <= 1 && styles.stepBtnDisabled]}
                    disabled={quantity <= 1}
                    onPress={handleMinus}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Kurangi jumlah tiket"
                  >
                    <Ionicons name="remove" size={20} color="#FAFAFA" />
                  </TouchableOpacity>
                </Animated.View>

                <Text style={styles.qtyText}>{quantity}</Text>

                <Animated.View style={plusAnimatedStyle}>
                  <TouchableOpacity
                    style={[styles.stepBtn, quantity >= maxAllowed && styles.stepBtnDisabled]}
                    disabled={quantity >= maxAllowed}
                    onPress={handlePlus}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Tambah jumlah tiket"
                  >
                    <Ionicons name="add" size={20} color="#FAFAFA" />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>
          )}

          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tentang Konser</Text>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.stickyFooter,
          { paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <View style={styles.footerPriceCol}>
          <Text style={styles.footerPriceLabel}>Total Pembayaran ({quantity} Tiket)</Text>
          <Text style={styles.footerPriceValue}>{formattedTotalPrice}</Text>
          {selectedCategory && (
            <Text style={styles.footerCategoryBadge} numberOfLines={1}>
              {selectedCategory.name}
            </Text>
          )}
        </View>

        <Animated.View style={checkoutAnimatedStyle}>
          <TouchableOpacity
            style={[
              styles.checkoutBtn,
              (event?.maintenanceMode || !selectedCategory || Number(selectedCategory.quotaRemaining) <= 0) &&
                styles.checkoutBtnDisabled,
            ]}
            disabled={event?.maintenanceMode || !selectedCategory || Number(selectedCategory.quotaRemaining) <= 0}
            onPressIn={() => {
              if (selectedCategory && Number(selectedCategory.quotaRemaining) > 0) {
                checkoutScale.set(withSpring(MOTION_TOKENS.pressScale.button, MOTION_TOKENS.springSnappy));
              }
            }}
            onPressOut={() => {
              checkoutScale.set(withSpring(1, MOTION_TOKENS.springSnappy));
            }}
            onPress={handleCheckout}
            activeOpacity={1}
            accessibilityRole="button"
            accessibilityLabel={event?.maintenanceMode ? "Pemesanan ditutup sementara" : "Beli Tiket Sekarang"}
          >
            <Text style={styles.checkoutBtnText}>{event?.maintenanceMode ? 'Pemesanan Ditutup' : 'Lanjut Checkout'}</Text>
            <Ionicons name="arrow-forward" size={16} color="#09090B" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#09090B',
    gap: 12,
  },
  loadingText: {
    color: '#71717A',
    fontSize: 14,
    fontWeight: '500',
  },
  topStickyHeader: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  circleIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(9, 9, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  coverWrapper: {
    width: '100%',
    height: 250,
    position: 'relative',
    backgroundColor: '#16161A',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  mainContent: {
    padding: 16,
  },
  topMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  publisherBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E1E24',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  publisherText: {
    color: BRAND_COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusOpenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_COLORS.success,
  },
  statusOpenText: {
    color: BRAND_COLORS.success,
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FAFAFA',
    lineHeight: 28,
    marginBottom: 16,
    letterSpacing: -0.4,
  },

  infoCard: {
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1F1F24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  infoLabel: {
    fontSize: 11,
    color: '#71717A',
    marginBottom: 2,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAFAFA',
  },
  infoSub: {
    fontSize: 11,
    color: '#A1A1AA',
    marginTop: 2,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#27272A',
    marginVertical: 12,
  },

  section: {
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAFAFA',
    letterSpacing: -0.2,
  },
  categoryCount: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  artistCard: {
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  artistPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: BRAND_COLORS.accent,
  },
  artistName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FAFAFA',
    marginBottom: 2,
  },
  artistBio: {
    fontSize: 11,
    color: '#A1A1AA',
    lineHeight: 16,
  },
  descriptionText: {
    fontSize: 13,
    color: '#D4D4D8',
    lineHeight: 20,
    marginTop: 8,
  },
  emptyCategories: {
    color: '#71717A',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },

  stepperSection: {
    backgroundColor: '#16161A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FAFAFA',
  },
  stepperSub: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.35,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAFAFA',
    minWidth: 24,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111114',
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPriceCol: {
    flex: 1,
    marginRight: 12,
  },
  footerPriceLabel: {
    fontSize: 10,
    color: '#71717A',
    fontWeight: '600',
  },
  footerPriceValue: {
    fontSize: 17,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
    marginTop: 2,
    letterSpacing: -0.3,
    fontVariant: ['tabular-nums'],
  },
  footerCategoryBadge: {
    fontSize: 11,
    color: '#A1A1AA',
    marginTop: 2,
  },
  checkoutBtn: {
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: BRAND_COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  checkoutBtnDisabled: {
    backgroundColor: '#3F3F46',
    opacity: 0.6,
  },
  checkoutBtnText: {
    color: '#09090B',
    fontWeight: '700',
    fontSize: 14,
  },
});
