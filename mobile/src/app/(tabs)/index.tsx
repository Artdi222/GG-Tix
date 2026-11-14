import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { apiEnvelope } from '../../services/api';
import { collectPages } from '../../services/pagination';
import { BRAND_COLORS } from '../../constants/config';
import { useAuthStore } from '../../store/auth-store';
import { EventCard, EventItem, isEventOver } from '../../components/EventCard';
import { HeroBannerCarousel } from '../../components/HeroBannerCarousel';
import { HomeSkeletonLoader } from '../../components/SkeletonLoader';

const ALL_CITIES = 'Semua Kota';
const ALL_TAGS = 'all';
const CITY_KEY = '@ggtix_home_city';

const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

const cityOf = (e: EventItem) => e.venue?.city?.trim() || '';

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Jakarta' }).format(new Date()));
  if (h < 11) return 'Selamat pagi';
  if (h < 15) return 'Selamat siang';
  if (h < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState(ALL_CITIES);
  const [tag, setTag] = useState(ALL_TAGS);
  const [cityOpen, setCityOpen] = useState(false);
  const [now] = useState(() => Date.now());

  const controllerRef = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const items = await collectPages<EventItem>((page) =>
        apiEnvelope<EventItem[]>(`/events?status=open&page=${page}&limit=100`, { signal: controller.signal })
      );
      if (controller.signal.aborted) return;
      // Sales can stay "open" after the show; past events are not something to buy.
      setEvents(items.filter((e) => !isEventOver(e)).sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime)));
      setError(null);
    } catch (err: any) {
      if (!controller.signal.aborted) setError(err?.message || 'Gagal memuat daftar konser.');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    // Fetch-on-mount: state is only set after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    AsyncStorage.getItem(CITY_KEY).then((saved) => { if (saved) setCity(saved); }).catch(() => {});
    return () => controllerRef.current?.abort();
  }, [load]);

  const chooseCity = (name: string) => {
    tap();
    setCity(name);
    setCityOpen(false);
    AsyncStorage.setItem(CITY_KEY, name).catch(() => {});
  };

  // Cities and tags come from the data, so a new venue city shows up without an app update.
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const c = cityOf(e);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [events]);

  // A remembered city that no longer has events falls back to everything instead of an empty home.
  const activeCity = city === ALL_CITIES || cities.some(([c]) => c === city) ? city : ALL_CITIES;

  const inCity = useMemo(
    () => (activeCity === ALL_CITIES ? events : events.filter((e) => cityOf(e) === activeCity)),
    [events, activeCity]
  );

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of inCity) for (const t of e.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [inCity]);
  const activeTag = tag === ALL_TAGS || tags.includes(tag) ? tag : ALL_TAGS;

  const visible = useMemo(
    () => (activeTag === ALL_TAGS ? inCity : inCity.filter((e) => e.tags?.includes(activeTag))),
    [inCity, activeTag]
  );

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return events.filter((e) =>
      [e.title, e.artist?.name, e.venue?.name, e.venue?.city, e.publisherName]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [events, q]);

  const featured = visible.slice(0, 4);
  const thisWeek = visible.filter((e) => +new Date(e.dateTime) - now < 7 * 86400000);
  const firstName = user?.name?.split(' ')[0];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting()}{firstName ? `, ${firstName}` : ''}</Text>
            <Pressable
              onPress={() => { tap(); setCityOpen(true); }}
              style={styles.cityPill}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Pilih kota, saat ini ${activeCity}`}
            >
              <Ionicons name="location" size={16} color={BRAND_COLORS.accent} />
              <Text style={styles.cityPillText} numberOfLines={1}>{activeCity}</Text>
              <Ionicons name="chevron-down" size={16} color="#18181B" />
            </Pressable>
          </View>
          <Pressable
            onPress={() => router.push(user ? '/(tabs)/profile' : '/auth/login')}
            style={styles.avatar}
            accessibilityRole="button"
            accessibilityLabel={user ? `Profil ${user.name}` : 'Masuk'}
          >
            {user ? (
              <Text style={styles.avatarText}>{user.name.slice(0, 1).toUpperCase()}</Text>
            ) : (
              <Ionicons name="person-outline" size={18} color="#18181B" />
            )}
          </Pressable>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color="#71717A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cari konser, artis, atau venue"
            placeholderTextColor="#A1A1AA"
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Cari konser"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Hapus pencarian">
              <Ionicons name="close-circle" size={18} color="#A1A1AA" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={BRAND_COLORS.accent} colors={[BRAND_COLORS.accent]} />
        }
      >
        {loading ? (
          <HomeSkeletonLoader />
        ) : error && !events.length ? (
          <State
            icon="cloud-offline-outline"
            title="Tidak bisa terhubung"
            body={error}
            action="Coba lagi"
            onAction={() => { setLoading(true); load(); }}
          />
        ) : q ? (
          <View style={styles.section}>
            <Text style={styles.resultCount}>{results.length} hasil untuk “{query.trim()}”</Text>
            {results.length ? (
              results.map((e) => <EventCard key={e.id} event={e} variant="row" />)
            ) : (
              <State icon="search-outline" title="Tidak ada yang cocok" body="Coba nama artis, venue, atau kota lain." />
            )}
          </View>
        ) : (
          <>
            {tags.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {[ALL_TAGS, ...tags].map((t) => {
                  const on = t === activeTag;
                  return (
                    <Pressable
                      key={t}
                      onPress={() => { tap(); setTag(t); }}
                      style={[styles.chip, on && styles.chipOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{t === ALL_TAGS ? 'Semua' : t}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {visible.length === 0 ? (
              <State
                icon="calendar-clear-outline"
                title={`Belum ada konser di ${activeCity}`}
                body="Jadwal baru akan muncul di sini. Sementara itu, lihat kota lain."
                action="Lihat semua kota"
                onAction={() => chooseCity(ALL_CITIES)}
              />
            ) : (
              <>
                <View style={styles.heroWrap}>
                  <HeroBannerCarousel items={featured} onPressItem={(item) => router.push(`/event/${item.id}`)} />
                </View>

                {thisWeek.length > 0 ? (
                  <View style={styles.section}>
                    <SectionTitle title="Minggu ini" />
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                      {thisWeek.map((e) => <EventCard key={e.id} event={e} variant="portrait" />)}
                    </ScrollView>
                  </View>
                ) : null}

                <View style={styles.section}>
                  <SectionTitle title={activeCity === ALL_CITIES ? 'Semua konser' : `Konser di ${activeCity}`} meta={`${visible.length} acara`} />
                  {visible.map((e) => <EventCard key={e.id} event={e} variant="row" />)}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={cityOpen} transparent animationType="slide" onRequestClose={() => setCityOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setCityOpen(false)} accessibilityLabel="Tutup pilihan kota" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Pilih kota</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {[[ALL_CITIES, events.length] as [string, number], ...cities].map(([name, count]) => {
              const on = name === activeCity;
              return (
                <Pressable
                  key={name}
                  onPress={() => chooseCity(name)}
                  style={({ pressed }) => [styles.cityRow, pressed && { backgroundColor: '#F4F4F5' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={name === ALL_CITIES ? 'globe-outline' : 'location-outline'} size={20} color={on ? BRAND_COLORS.accent : '#52525B'} />
                  <Text style={[styles.cityRowText, on && { color: BRAND_COLORS.accent }]}>{name}</Text>
                  <Text style={styles.cityRowCount}>{count}</Text>
                  {on ? <Ionicons name="checkmark" size={20} color={BRAND_COLORS.accent} /> : <View style={{ width: 20 }} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}
    </View>
  );
}

function State({ icon, title, body, action, onAction }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.state}>
      <View style={styles.stateIcon}><Ionicons name={icon} size={26} color="#52525B" /></View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.stateBtn} accessibilityRole="button">
          <Text style={styles.stateBtnText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#FFFFFF' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  greeting: { fontSize: 13, color: '#71717A', fontWeight: '500' },
  cityPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, alignSelf: 'flex-start', minHeight: 32 },
  cityPillText: { fontSize: 20, fontWeight: '800', color: '#18181B', letterSpacing: -0.4, maxWidth: 220 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F4F4F5', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800', color: '#18181B' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: '#F4F4F5' },
  searchInput: { flex: 1, fontSize: 15, color: '#18181B', paddingVertical: 0 },

  chips: { paddingHorizontal: 20, gap: 8, paddingVertical: 4 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: '#F4F4F5', justifyContent: 'center' },
  chipOn: { backgroundColor: '#18181B' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#3F3F46' },
  chipTextOn: { color: '#FFFFFF' },

  heroWrap: { marginTop: 16 },
  section: { paddingHorizontal: 20, marginTop: 28, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#18181B', letterSpacing: -0.3 },
  sectionMeta: { fontSize: 13, color: '#71717A', fontWeight: '500' },
  rail: { gap: 12, paddingRight: 20 },
  resultCount: { fontSize: 13, color: '#71717A', fontWeight: '500' },

  state: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 56, gap: 8 },
  stateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F4F4F5', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  stateTitle: { fontSize: 17, fontWeight: '700', color: '#18181B', textAlign: 'center' },
  stateBody: { fontSize: 14, color: '#71717A', textAlign: 'center', lineHeight: 20 },
  stateBtn: { marginTop: 12, height: 44, paddingHorizontal: 20, borderRadius: 22, backgroundColor: '#18181B', justifyContent: 'center' },
  stateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 12 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: '#D4D4D8', marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#18181B', paddingHorizontal: 8, marginBottom: 8 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 8, borderRadius: 12 },
  cityRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#18181B' },
  cityRowCount: { fontSize: 13, color: '#A1A1AA', fontWeight: '600' },
});
