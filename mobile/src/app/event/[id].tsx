import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';
import { useAuthStore } from '../../store/auth-store';
import { CategoryCard, TicketCategoryItem } from '../../components/CategoryCard';

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
  const [showSeatmap, setShowSeatmap] = useState(false);

  const router = useRouter();
  const token = useAuthStore((state) => state.token);

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

  const handleCheckout = () => {
    if (!selectedCategory) {
      Alert.alert('Peringatan', 'Silakan pilih kategori tiket terlebih dahulu.');
      return;
    }

    if (!token) {
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
        categoryName: selectedCategory.name,
        price: selectedCategory.price.toString(),
      },
    });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
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
        <Text style={styles.loadingText}>Memuat detail konser...</Text>
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Banner Cover Image */}
        <View style={styles.coverWrapper}>
          <Image
            source={{
              uri:
                event.imageUrl ||
                'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop&q=80',
            }}
            style={styles.coverImage}
            contentFit="cover"
          />
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.mainContent}>
          {/* Publisher Badge */}
          {event.publisherName && (
            <View style={styles.publisherBadge}>
              <Text style={styles.publisherText}>DIPERSEMBAHKAN OLEH {event.publisherName.toUpperCase()}</Text>
            </View>
          )}

          <Text style={styles.title}>{event.title}</Text>

          {/* Key Info Cards */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="calendar" size={18} color={BRAND_COLORS.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Tanggal & Waktu</Text>
                <Text style={styles.infoValue}>{formatDate(event.dateTime)} WIB</Text>
              </View>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Ionicons name="location" size={18} color={BRAND_COLORS.accent} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoLabel}>Lokasi Venue</Text>
                <Text style={styles.infoValue}>
                  {event.venue ? `${event.venue.name}, ${event.venue.city}` : 'Venue TBA'}
                </Text>
                {event.venue?.address ? (
                  <Text style={styles.infoSub}>{event.venue.address}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Artist Section */}
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

          {/* Description Section */}
          {event.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Deskripsi Event</Text>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          ) : null}

          {/* Seatmap Preview if available */}
          {event.seatmapUrl ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Layout Tempat Duduk (Seatmap)</Text>
                <TouchableOpacity onPress={() => setShowSeatmap(!showSeatmap)}>
                  <Text style={styles.toggleText}>{showSeatmap ? 'Sembunyikan' : 'Lihat'}</Text>
                </TouchableOpacity>
              </View>
              {showSeatmap && (
                <View style={styles.seatmapContainer}>
                  <Image
                    source={{ uri: event.seatmapUrl }}
                    style={styles.seatmapImage}
                    contentFit="contain"
                  />
                </View>
              )}
            </View>
          ) : null}

          {/* Ticket Categories Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pilih Kategori Tiket</Text>
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

          {/* Quantity Stepper */}
          {selectedCategory && Number(selectedCategory.quotaRemaining) > 0 && (
            <View style={styles.stepperSection}>
              <View>
                <Text style={styles.stepperLabel}>Jumlah Tiket</Text>
                <Text style={styles.stepperSub}>Maksimal {maxAllowed} tiket per transaksi</Text>
              </View>

              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[styles.stepBtn, quantity <= 1 && styles.stepBtnDisabled]}
                  disabled={quantity <= 1}
                  onPress={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Ionicons name="remove" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                <Text style={styles.qtyText}>{quantity}</Text>

                <TouchableOpacity
                  style={[styles.stepBtn, quantity >= maxAllowed && styles.stepBtnDisabled]}
                  disabled={quantity >= maxAllowed}
                  onPress={() => setQuantity((q) => Math.min(maxAllowed, q + 1))}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <View style={styles.stickyFooter}>
        <View>
          <Text style={styles.footerPriceLabel}>Total Pembayaran</Text>
          <Text style={styles.footerPriceValue}>{formattedTotalPrice}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.checkoutBtn,
            (!selectedCategory || Number(selectedCategory.quotaRemaining) <= 0) &&
              styles.checkoutBtnDisabled,
          ]}
          disabled={!selectedCategory || Number(selectedCategory.quotaRemaining) <= 0}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutBtnText}>Beli Tiket</Text>
          <Ionicons name="arrow-forward" size={18} color={BRAND_COLORS.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.bgDark,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.bgDark,
    gap: 12,
  },
  loadingText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 14,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  coverWrapper: {
    width: '100%',
    height: 260,
    position: 'relative',
    backgroundColor: '#20173A',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 48,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(27, 19, 48, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    padding: 18,
  },
  publisherBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(242, 169, 59, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(242, 169, 59, 0.4)',
    marginBottom: 8,
  },
  publisherText: {
    color: BRAND_COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    lineHeight: 30,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: BRAND_COLORS.textMuted,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoSub: {
    fontSize: 12,
    color: BRAND_COLORS.textMuted,
    marginTop: 2,
  },
  infoDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  toggleText: {
    color: BRAND_COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  artistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  artistPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  artistName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  artistBio: {
    fontSize: 12,
    color: BRAND_COLORS.textMuted,
    lineHeight: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: BRAND_COLORS.textLight,
    lineHeight: 22,
  },
  seatmapContainer: {
    backgroundColor: '#0F0B1B',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
  },
  seatmapImage: {
    width: '100%',
    height: 200,
  },
  emptyCategories: {
    color: BRAND_COLORS.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  stepperSection: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepperLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stepperSub: {
    fontSize: 11,
    color: BRAND_COLORS.textMuted,
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3D3063',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    minWidth: 20,
    textAlign: 'center',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: BRAND_COLORS.primary,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerPriceLabel: {
    fontSize: 11,
    color: BRAND_COLORS.textMuted,
  },
  footerPriceValue: {
    fontSize: 18,
    fontWeight: '800',
    color: BRAND_COLORS.accent,
  },
  checkoutBtn: {
    backgroundColor: BRAND_COLORS.accent,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkoutBtnDisabled: {
    opacity: 0.5,
  },
  checkoutBtnText: {
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
    fontSize: 15,
  },
});
