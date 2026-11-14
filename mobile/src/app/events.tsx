import React, { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StatusBar, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { EventCard } from '../components/EventCard';
import { AppTopBar, CityBar, PageHeader, PillTabs, INK, MUTED, CANVAS } from '../components/layout';
import { useOpenEvents } from '../hooks/useOpenEvents';

type Tab = 'all' | 'week';

/** Full concert list: search, "all / this week" tabs and a two-column poster grid. */
export default function EventsScreen() {
  const params = useLocalSearchParams<{ tab?: string; focus?: string }>();
  const { width } = useWindowDimensions();
  const { events, cities, activeCity, inCity, loading, error, reload } = useOpenEvents();
  const [tab, setTab] = useState<Tab>(params.tab === 'week' ? 'week' : 'all');
  const [query, setQuery] = useState('');
  const [now] = useState(() => Date.now());
  const inputRef = useRef<TextInput>(null);

  const q = query.trim().toLowerCase();
  const list = useMemo(() => {
    // Search covers every city so a typed artist is found even outside the chosen city.
    let items = q ? events : inCity;
    if (tab === 'week') items = items.filter((e) => +new Date(e.dateTime) - now < 7 * 86400000);
    if (q) {
      items = items.filter((e) =>
        [e.title, e.artist?.name, e.venue?.name, e.venue?.city, e.publisherName, ...(e.tags ?? [])]
          .some((v) => v?.toLowerCase().includes(q))
      );
    }
    return items;
  }, [events, inCity, tab, q, now]);

  const cardWidth = Math.floor((Math.min(width, 520) - 16 * 2 - 12) / 2);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <AppTopBar onSearch={() => inputRef.current?.focus()} />
      <CityBar city={activeCity} cities={cities} total={events.length} />

      <FlatList
        data={list}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ paddingBottom: 40, rowGap: 20 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <PageHeader title="Konser" back />
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={MUTED} />
              <TextInput
                ref={inputRef}
                value={query}
                onChangeText={setQuery}
                autoFocus={params.focus === '1'}
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
            <PillTabs<Tab>
              value={tab}
              onChange={setTab}
              items={[{ value: 'all', label: 'Semua' }, { value: 'week', label: 'Minggu ini' }]}
            />
            {q ? <Text style={styles.count}>{list.length} hasil di semua kota</Text> : null}
          </View>
        }
        renderItem={({ item }) => <EventCard event={item} variant="poster" width={cardWidth} />}
        ListEmptyComponent={
          loading ? (
            <Text style={styles.note}>Memuat konser…</Text>
          ) : error && !events.length ? (
            <Pressable onPress={() => void reload()} accessibilityRole="button">
              <Text style={styles.note}>{error} Ketuk untuk coba lagi.</Text>
            </Pressable>
          ) : (
            <Text style={styles.note}>
              {q ? 'Tidak ada konser yang cocok.' : tab === 'week' ? 'Tidak ada konser minggu ini.' : `Belum ada konser di ${activeCity}.`}
            </Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: CANVAS },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, marginHorizontal: 16, marginBottom: 14, borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E4E7' },
  searchInput: { flex: 1, fontSize: 15, color: INK, paddingVertical: 0 },
  count: { fontSize: 13, color: MUTED, paddingHorizontal: 16, marginTop: -4, marginBottom: 8 },
  note: { textAlign: 'center', color: MUTED, fontSize: 14, paddingHorizontal: 32, paddingVertical: 40 },
});
