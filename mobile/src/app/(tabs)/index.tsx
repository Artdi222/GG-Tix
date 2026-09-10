import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiEnvelope } from '../../services/api';
import { collectPages } from '../../services/pagination';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BRAND_COLORS } from '../../constants/config';
import { MOTION_TOKENS } from '../../constants/motion';
import { useAuthStore } from '../../store/auth-store';
import { EventCard, EventItem } from '../../components/EventCard';
import { HeroBannerCarousel } from '../../components/HeroBannerCarousel';
import { HomeSkeletonLoader } from '../../components/SkeletonLoader';

interface CityItem {
  name: string;
  label: string;
  iconName: React.ComponentProps<typeof Ionicons>['name'];
}

const CITY_LIST: CityItem[] = [
  { name: 'Semua Kota', label: 'Semua', iconName: 'globe-outline' },
  { name: 'Jakarta', label: 'Jakarta', iconName: 'business-outline' },
  { name: 'Bandung', label: 'Bandung', iconName: 'cafe-outline' },
  { name: 'Surabaya', label: 'Surabaya', iconName: 'water-outline' },
  { name: 'Bali', label: 'Bali', iconName: 'sunny-outline' },
  { name: 'Yogyakarta', label: 'Jogja', iconName: 'color-palette-outline' },
  { name: 'Medan', label: 'Medan', iconName: 'trail-sign-outline' },
];

const GENRE_CHIPS = [
  { id: 'all', label: 'Semua', icon: 'apps-outline' },
  { id: 'gaming', label: 'Gaming OST', icon: 'game-controller-outline' },
  { id: 'anime', label: 'Anime & J-Pop', icon: 'sparkles-outline' },
  { id: 'rock', label: 'Rock & Metal', icon: 'musical-notes-outline' },
  { id: 'festival', label: 'Festival', icon: 'bonfire-outline' },
  { id: 'kpop', label: 'K-Pop', icon: 'star-outline' },
];

interface CityCardItemProps {
  item: CityItem & { count: number };
  isSelected: boolean;
  onSelect: () => void;
}

function CityCardItem({ item, isSelected, onSelect }: CityCardItemProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.set(withSpring(0.95, MOTION_TOKENS.springSnappy));
  };

  const handlePressOut = () => {
    scale.set(withSpring(1, MOTION_TOKENS.springSnappy));
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {

      }
    }
    onSelect();
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.cityCard, isSelected && styles.cityCardActive]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={`Filter kota ${item.label}, ${item.count} konser`}
      >
        <View style={[styles.cityCardIconWrap, isSelected && styles.cityCardIconWrapActive]}>
          <Ionicons
            name={item.iconName}
            size={18}
            color={isSelected ? BRAND_COLORS.accent : '#A1A1AA'}
          />
        </View>
        <Text style={[styles.cityCardName, isSelected && styles.cityCardNameActive]} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={[styles.cityCardCount, isSelected && styles.cityCardCountActive]}>
          {item.count} Event
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('Jakarta');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cityModalVisible, setCityModalVisible] = useState(false);

  const loadEvents = useCallback(async () => {
    try {
      setErrorMessage(null);
      const items = await collectPages<EventItem>(page => apiEnvelope<EventItem[]>(`/events?status=open&page=${page}&limit=100`));
      setEvents(items);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memuat daftar konser');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    collectPages<EventItem>(page => apiEnvelope<EventItem[]>(`/events?status=open&page=${page}&limit=100`, { signal: controller.signal }))
      .then((items) => {
        if (!isMounted) return;
        setEvents(items);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Gagal memuat daftar konser');
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    let result = events;

    if (selectedGenre !== 'all') {
      result = result.filter((evt) => {
        const text = `${evt.title} ${evt.tags?.join(' ') || ''} ${evt.description || ''}`.toLowerCase();
        if (selectedGenre === 'gaming') return text.includes('game') || text.includes('genshin') || text.includes('esports') || text.includes('ost');
        if (selectedGenre === 'anime') return text.includes('anime') || text.includes('j-pop') || text.includes('japan') || text.includes('vocaloid');
        if (selectedGenre === 'rock') return text.includes('rock') || text.includes('metal') || text.includes('band');
        if (selectedGenre === 'festival') return text.includes('fest') || text.includes('symphony');
        if (selectedGenre === 'kpop') return text.includes('k-pop') || text.includes('kpop') || text.includes('korea');
        return true;
      });
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((evt) => {
        return (
          evt.title.toLowerCase().includes(q) ||
          (evt.artist?.name && evt.artist.name.toLowerCase().includes(q)) ||
          (evt.venue?.name && evt.venue.name.toLowerCase().includes(q)) ||
          (evt.venue?.city && evt.venue.city.toLowerCase().includes(q)) ||
          (evt.publisherName && evt.publisherName.toLowerCase().includes(q))
        );
      });
    }

    return result;
  }, [events, searchQuery, selectedGenre]);

  const heroBanners = useMemo(() => {
    return events.slice(0, 4);
  }, [events]);

  const hypeEvents = useMemo(() => {
    return events.slice(0, 6);
  }, [events]);

  const cityCards = useMemo(() => {
    return CITY_LIST.map((c) => {
      if (c.name === 'Semua Kota') {
        return { ...c, count: events.length };
      }
      const count = events.filter((evt) =>
        evt.venue?.city?.toLowerCase().includes(c.name.toLowerCase())
      ).length;
      return { ...c, count };
    });
  }, [events]);

  const localEvents = useMemo(() => {
    if (selectedCity === 'Semua Kota') return filteredEvents;
    return filteredEvents.filter((evt) => {
      const city = evt.venue?.city?.toLowerCase() || '';
      return city.includes(selectedCity.toLowerCase());
    });
  }, [filteredEvents, selectedCity]);

  const isSearching = searchQuery.trim().length > 0;

  return (
    <View style={styles.screenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#050507" />

      <View style={[styles.headerContainer, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandText}>GG</Text>
            <View style={styles.brandDot} />
          </View>
          <View>
            <Text style={styles.greetingSubText}>Eksklusif Konser</Text>
            <TouchableOpacity
              style={styles.locationSelectorBtn}
              onPress={() => setCityModalVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Pilih kota konser, saat ini ${selectedCity}`}
            >
              <Ionicons name="location" size={13} color={BRAND_COLORS.accent} />
              <Text style={styles.locationSelectorText} numberOfLines={1}>{selectedCity}</Text>
              <Ionicons name="chevron-down" size={11} color="#A1A1AA" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {}}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Notifikasi"
          >
            <Ionicons name="notifications-outline" size={18} color="#FAFAFA" />
            <View style={styles.notificationDot} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={user ? `Profil ${user.name}` : 'Buka Halaman Masuk'}
          >
            {user ? (
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
            ) : (
              <Ionicons name="person-outline" size={18} color="#A1A1AA" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchFilterWrapper}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search-outline" size={18} color="#71717A" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari konser impian, artis, atau venue..."
            placeholderTextColor="#71717A"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            accessibilityLabel="Input pencarian konser"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              style={styles.clearSearchBtn}
              accessibilityRole="button"
              accessibilityLabel="Hapus teks pencarian"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={16} color="#71717A" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genreScroll}
        >
          {GENRE_CHIPS.map((genre) => {
            const isActive = selectedGenre === genre.id;
            return (
              <TouchableOpacity
                key={genre.id}
                style={[styles.genreChip, isActive && styles.genreChipActive]}
                onPress={() => {
                  if (Platform.OS !== 'web') {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch {}
                  }
                  setSelectedGenre(genre.id);
                }}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Filter genre ${genre.label}`}
              >
                <Ionicons
                  name={genre.icon as any}
                  size={14}
                  color={isActive ? '#050507' : '#A1A1AA'}
                />
                <Text style={[styles.genreChipText, isActive && styles.genreChipTextActive]}>
                  {genre.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.mainScrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={BRAND_COLORS.accent}
            colors={[BRAND_COLORS.accent]}
          />
        }
      >
        {loading && !refreshing ? (
          <HomeSkeletonLoader />
        ) : errorMessage ? (
          <View style={styles.errorContainer}>
            <View style={styles.errorIconBox}>
              <Ionicons name="alert-circle" size={28} color={BRAND_COLORS.danger} />
            </View>
            <Text style={styles.errorTitle}>Koneksi Bermasalah</Text>
            <Text style={styles.errorSubtitle}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadEvents}
              accessibilityRole="button"
              accessibilityLabel="Coba muat ulang daftar konser"
            >
              <Ionicons name="refresh" size={14} color="#FAFAFA" />
              <Text style={styles.retryButtonText}>Muat Ulang</Text>
            </TouchableOpacity>
          </View>
        ) : isSearching ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Hasil Pencarian</Text>
              <Text style={styles.sectionBadgeCount}>{filteredEvents.length} Ditemukan</Text>
            </View>

            {filteredEvents.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="search" size={32} color="#52525B" />
                <Text style={styles.emptyTitle}>Konser Tidak Ditemukan</Text>
                <Text style={styles.emptySubtitle}>Tidak ada jadwal yang cocok dengan kata kunci &quot;{searchQuery}&quot;</Text>
              </View>
            ) : (
              filteredEvents.map((evt) => (
                <EventCard key={`search-${evt.id}`} event={evt} variant="row" />
              ))
            )}
          </View>
        ) : (
          <View>
            {heroBanners.length > 0 && (
              <View style={styles.heroSection}>
                <HeroBannerCarousel
                  items={heroBanners}
                  onPressItem={(item) => router.push(`/event/${item.id}`)}
                />
              </View>
            )}

            {hypeEvents.length > 0 && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <View style={styles.accentIndicator} />
                    <Text style={styles.sectionTitle}>Sedang Hype & Tren</Text>
                  </View>
                  <Text style={styles.sectionActionText}>Paling dicari fans</Text>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalCardList}
                >
                  {hypeEvents.map((evt) => (
                    <EventCard key={`hype-${evt.id}`} event={evt} variant="portrait" />
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.accentIndicator} />
                  <Text style={styles.sectionTitle}>Jelajahi Berdasarkan Kota</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setCityModalVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Lihat semua pilihan kota"
                >
                  <Text style={styles.sectionActionLink}>Semua Kota →</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cityScrollContent}
                style={styles.cityScrollWrapper}
              >
                {cityCards.map((c) => (
                  <CityCardItem
                    key={`city-${c.name}`}
                    item={c}
                    isSelected={selectedCity === c.name}
                    onSelect={() => setSelectedCity(c.name)}
                  />
                ))}
              </ScrollView>

              <View style={styles.cityFeedSubHeader}>
                <Text style={styles.cityFeedTitle}>Konser di {selectedCity}</Text>
                <Text style={styles.cityFeedCount}>{localEvents.length} Event Aktif</Text>
              </View>

              {localEvents.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="location-outline" size={32} color="#52525B" />
                  <Text style={styles.emptyTitle}>Belum Ada Konser di {selectedCity}</Text>
                  <Text style={styles.emptySubtitle}>Pilih kota lainnya atau cek jadwal di seluruh Indonesia.</Text>
                </View>
              ) : (
                localEvents.map((evt) => (
                  <EventCard key={`local-${evt.id}`} event={evt} variant="row" />
                ))
              )}
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>
      <Modal
        visible={cityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCityModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCityModalVisible(false)}
        >
          <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}>
            <View style={styles.modalHandleBar} />
            <Text style={styles.modalTitle}>Pilih Kota Konser</Text>
            <Text style={styles.modalSubtitle}>Temukan kemeriahan event musik di kotamu</Text>

            <View style={styles.modalGrid}>
              {CITY_LIST.map((city) => {
                const isSelected = selectedCity === city.name;
                return (
                  <TouchableOpacity
                    key={`modal-city-${city.name}`}
                    style={[styles.modalCityCard, isSelected && styles.modalCityCardActive]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        try {
                          Haptics.selectionAsync();
                        } catch {}
                      }
                      setSelectedCity(city.name);
                      setCityModalVisible(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Pilih kota ${city.name}`}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={city.iconName}
                      size={18}
                      color={isSelected ? BRAND_COLORS.accent : '#A1A1AA'}
                    />
                    <Text style={[styles.modalCityText, isSelected && styles.modalCityTextActive]}>
                      {city.name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={18} color={BRAND_COLORS.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: '#050507',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#050507',
    borderBottomWidth: 1,
    borderBottomColor: '#121216',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#121216',
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  brandText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FAFAFA',
    letterSpacing: 0.5,
  },
  brandDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BRAND_COLORS.accent,
  },
  greetingSubText: {
    fontSize: 10,
    color: '#71717A',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  locationSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationSelectorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FAFAFA',
    maxWidth: 130,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#121216',
    borderWidth: 1,
    borderColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BRAND_COLORS.accent,
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BRAND_COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#050507',
  },

  searchFilterWrapper: {
    backgroundColor: '#050507',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#121216',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121216',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    borderWidth: 1,
    borderColor: '#222228',
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#FAFAFA',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  genreScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  genreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#121216',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222228',
  },
  genreChipActive: {
    backgroundColor: BRAND_COLORS.accent,
    borderColor: BRAND_COLORS.accent,
  },
  genreChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  genreChipTextActive: {
    fontSize: 12,
    fontWeight: '800',
    color: '#050507',
  },

  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    marginTop: 4,
    marginBottom: 8,
  },

  sectionBlock: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accentIndicator: {
    width: 3,
    height: 16,
    borderRadius: 1.5,
    backgroundColor: BRAND_COLORS.accent,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FAFAFA',
    letterSpacing: -0.2,
  },
  sectionActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },
  sectionActionLink: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_COLORS.accent,
  },
  sectionBadgeCount: {
    fontSize: 12,
    fontWeight: '700',
    color: BRAND_COLORS.accent,
  },
  horizontalCardList: {
    gap: 12,
    paddingBottom: 4,
  },

  cityScrollWrapper: {
    marginBottom: 16,
  },
  cityScrollContent: {
    gap: 10,
  },
  cityCard: {
    backgroundColor: '#121216',
    borderRadius: 16,
    padding: 12,
    width: 100,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222228',
    gap: 6,
  },
  cityCardActive: {
    backgroundColor: '#1A1A22',
    borderColor: BRAND_COLORS.accent,
  },
  cityCardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#18181D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cityCardIconWrapActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  cityCardName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  cityCardNameActive: {
    color: '#FAFAFA',
  },
  cityCardCount: {
    fontSize: 10,
    fontWeight: '600',
    color: '#71717A',
  },
  cityCardCountActive: {
    color: BRAND_COLORS.accent,
  },

  cityFeedSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 4,
  },
  cityFeedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FAFAFA',
  },
  cityFeedCount: {
    fontSize: 11,
    fontWeight: '600',
    color: '#71717A',
  },

  emptyCard: {
    backgroundColor: '#121216',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#222228',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FAFAFA',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 18,
  },

  errorContainer: {
    margin: 16,
    backgroundColor: '#121216',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    gap: 10,
  },
  errorIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FAFAFA',
  },
  errorSubtitle: {
    fontSize: 12,
    color: '#A1A1AA',
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#27272A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FAFAFA',
  },

  bottomSpacer: {
    height: 30,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0E0E12',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222228',
  },
  modalHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3F3F46',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FAFAFA',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#71717A',
    marginBottom: 20,
  },
  modalGrid: {
    gap: 10,
    marginBottom: 12,
  },
  modalCityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#16161C',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222228',
  },
  modalCityCardActive: {
    backgroundColor: '#1E1E28',
    borderColor: BRAND_COLORS.accent,
  },
  modalCityText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#A1A1AA',
  },
  modalCityTextActive: {
    color: '#FAFAFA',
  },
});
