import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  FlatList,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '../../services/api';
import { BRAND_COLORS } from '../../constants/config';
import { EventCard, EventItem } from '../../components/EventCard';
import { EventCardSkeleton } from '../../components/SkeletonLoader';

export default function HomeScreen() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('Semua');

  const router = useRouter();

  const loadEvents = useCallback(async () => {
    try {
      const res = await apiFetch<any>('/events?status=open');
      const eventList = Array.isArray(res) ? res : res.data || res.items || [];
      setEvents(eventList);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    apiFetch<any>('/events?status=open')
      .then((res) => {
        if (!isMounted) return;
        const eventList = Array.isArray(res) ? res : res.data || res.items || [];
        setEvents(eventList);
      })
      .catch(() => {
        if (!isMounted) return;
        setEvents([]);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadEvents();
  }, [loadEvents]);

  const tags = ['Semua', 'Game', 'Anime', 'Orchestra', 'Esports'];

  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      searchQuery.trim() === '' ||
      evt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.artist?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.venue?.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      evt.publisherName?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTag =
      selectedTag === 'Semua' ||
      (evt.title && evt.title.toLowerCase().includes(selectedTag.toLowerCase())) ||
      (evt.description && evt.description.toLowerCase().includes(selectedTag.toLowerCase()));

    return matchesSearch && matchesTag;
  });

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.heroBanner}>
        <Text style={styles.heroSub}>EXCLUSIVE GAME CONCERTS</Text>
        <Text style={styles.heroTitle}>Saksikan Musik Game Favoritmu Secara Langsung</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchWrapper}>
        <Ionicons name="search" size={18} color={BRAND_COLORS.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari konser, artis, atau kota..."
          placeholderTextColor="#6B7280"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={18} color={BRAND_COLORS.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tags Filter */}
      <View style={styles.tagsContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={tags}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isSelected = selectedTag === item;
            return (
              <TouchableOpacity
                style={[styles.tagChip, isSelected && styles.tagChipActive]}
                onPress={() => setSelectedTag(item)}
              >
                <Text style={[styles.tagText, isSelected && styles.tagTextActive]}>{item}</Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.tagsContent}
        />
      </View>

      <Text style={styles.sectionHeading}>Konser Mendatang</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          {renderHeader()}
          <EventCardSkeleton />
          <EventCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => router.push(`/event/${item.id}`)}
            />
          )}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={BRAND_COLORS.accent}
              colors={[BRAND_COLORS.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={54} color={BRAND_COLORS.muted} />
              <Text style={styles.emptyTitle}>Tidak Ada Event</Text>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `Tidak ditemukan konser untuk kata kunci "${searchQuery}"`
                  : 'Belum ada event yang tersedia saat ini. Pantau terus ya!'}
              </Text>
              {searchQuery ? (
                <TouchableOpacity style={styles.resetBtn} onPress={() => setSearchQuery('')}>
                  <Text style={styles.resetBtnText}>Reset Pencarian</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_COLORS.bgDark,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    padding: 16,
  },
  headerContainer: {
    marginBottom: 16,
  },
  heroBanner: {
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(242, 169, 59, 0.25)',
  },
  heroSub: {
    color: BRAND_COLORS.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    lineHeight: 26,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    paddingVertical: 12,
    fontSize: 14,
  },
  clearBtn: {
    padding: 4,
  },
  tagsContainer: {
    marginBottom: 16,
  },
  tagsContent: {
    gap: 8,
  },
  tagChip: {
    backgroundColor: BRAND_COLORS.cardBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  tagChipActive: {
    backgroundColor: BRAND_COLORS.accent,
    borderColor: BRAND_COLORS.accent,
  },
  tagText: {
    color: BRAND_COLORS.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  tagTextActive: {
    color: BRAND_COLORS.primary,
    fontWeight: 'bold',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  emptyText: {
    color: BRAND_COLORS.textMuted,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
  },
  resetBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: BRAND_COLORS.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BRAND_COLORS.accent,
  },
  resetBtnText: {
    color: BRAND_COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
});
