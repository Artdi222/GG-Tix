import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EventCard, type EventItem } from '../../components/EventCard';
import { HeroBannerCarousel } from '../../components/HeroBannerCarousel';
import { HomeSkeletonLoader } from '../../components/SkeletonLoader';
import { AppTopBar, CityBar, DottedDivider, SectionHeader, INK, MUTED, CANVAS, tap } from '../../components/layout';
import { useOpenEvents } from '../../hooks/useOpenEvents';
import { ALL_CITIES, useCityStore } from '../../store/city-store';

const soldRatio = (e: EventItem) => (e.capacity ? (e.sold ?? 0) / e.capacity : 0);

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { events, loading, error, cities, activeCity, inCity, reload } = useOpenEvents();
  const setCity = useCityStore((s) => s.setCity);
  const [refreshing, setRefreshing] = useState(false);
  const [now] = useState(() => Date.now());

  const popular = useMemo(() => [...inCity].sort((a, b) => soldRatio(b) - soldRatio(a)).slice(0, 8), [inCity]);
  const thisWeek = useMemo(() => inCity.filter((e) => +new Date(e.dateTime) - now < 7 * 86400000), [inCity, now]);
  const gridWidth = Math.floor((Math.min(width, 520) - 16 * 2 - 12) / 2);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <AppTopBar />
      <CityBar city={activeCity} cities={cities} total={events.length} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INK} colors={[INK]} />}
      >
        {loading ? (
          <HomeSkeletonLoader />
        ) : error && !events.length ? (
          <Empty icon="cloud-offline-outline" title="Tidak bisa terhubung" body={error} action="Coba lagi" onAction={() => void reload()} />
        ) : inCity.length === 0 ? (
          <Empty
            icon="calendar-clear-outline"
            title={`Belum ada konser di ${activeCity}`}
            body="Jadwal baru akan muncul di sini. Sementara itu, lihat kota lain."
            action="Lihat semua kota"
            onAction={() => setCity(ALL_CITIES)}
          />
        ) : (
          <>
            <HeroBannerCarousel items={inCity.slice(0, 4)} onPressItem={(item) => router.push(`/event/${item.id}`)} />

            <View style={styles.block}>
              <SectionHeader
                title="Konser populer"
                subtitle="Paling banyak tiket terjual"
                onAction={() => router.push('/events')}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                {popular.map((e, i) => <EventCard key={e.id} event={e} variant="poster" rank={i + 1} />)}
              </ScrollView>
            </View>

            {thisWeek.length > 0 ? (
              <>
                <DottedDivider />
                <View>
                  <SectionHeader
                    title="Minggu ini"
                    subtitle="Tinggal beberapa hari lagi"
                    onAction={() => router.push({ pathname: '/events', params: { tab: 'week' } })}
                  />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
                    {thisWeek.map((e) => <EventCard key={e.id} event={e} variant="poster" width={148} />)}
                  </ScrollView>
                </View>
              </>
            ) : null}

            <DottedDivider />
            <View>
              <SectionHeader
                title="Semua konser"
                subtitle={activeCity === ALL_CITIES ? 'Di seluruh kota' : `Di ${activeCity}`}
                onAction={() => router.push('/events')}
              />
              <View style={styles.grid}>
                {inCity.slice(0, 6).map((e) => <EventCard key={e.id} event={e} variant="poster" width={gridWidth} />)}
              </View>
              {inCity.length > 6 ? (
                <Pressable style={styles.moreBtn} onPress={() => { tap(); router.push('/events'); }} accessibilityRole="button">
                  <Text style={styles.moreText}>Lihat {inCity.length - 6} konser lainnya</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Empty({ icon, title, body, action, onAction }: {
  icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={26} color="#52525B" /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} style={styles.emptyBtn} accessibilityRole="button">
          <Text style={styles.emptyBtnText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CANVAS },
  block: { marginTop: 24 },
  rail: { gap: 14, paddingHorizontal: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, rowGap: 20, paddingHorizontal: 16 },
  moreBtn: { marginHorizontal: 16, marginTop: 20, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: INK, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 15, fontWeight: '800', color: INK },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingVertical: 56, gap: 8 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: INK, textAlign: 'center' },
  emptyBody: { fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 12, height: 44, paddingHorizontal: 20, borderRadius: 12, backgroundColor: INK, justifyContent: 'center' },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
