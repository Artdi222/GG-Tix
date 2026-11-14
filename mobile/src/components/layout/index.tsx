import React from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '../../store/auth-store';
import { ALL_CITIES, useCityStore } from '../../store/city-store';

export const INK = '#18181B';
export const GOLD = '#F5A524';
export const ACCENT = '#B4630A';
export const MUTED = '#71717A';
export const CANVAS = '#F6F6F8';

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

/** Brand bar shared by every tab: wordmark, search, and sign-in or the account avatar. */
export function AppTopBar({ onSearch }: { onSearch?: () => void }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.navigate('/(tabs)')} accessibilityRole="button" accessibilityLabel="GG Tix, ke beranda" hitSlop={8}>
        <Text style={styles.wordmark}>GG<Text style={{ color: GOLD }}>·</Text>TIX</Text>
      </Pressable>
      <View style={styles.topActions}>
        <Pressable
          style={styles.iconBtn}
          onPress={() => { tap(); if (onSearch) onSearch(); else router.push({ pathname: '/events', params: { focus: '1' } }); }}
          accessibilityRole="button"
          accessibilityLabel="Cari konser"
        >
          <Ionicons name="search" size={18} color="#FFFFFF" />
        </Pressable>
        {user ? (
          <Pressable style={styles.avatar} onPress={() => router.navigate('/(tabs)/profile')} accessibilityRole="button" accessibilityLabel={`Akun ${user.name}`}>
            <Text style={styles.avatarText}>{user.name.slice(0, 1).toUpperCase()}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable style={styles.outlineBtn} onPress={() => router.push('/auth/register')} accessibilityRole="button">
              <Text style={styles.outlineBtnText}>Daftar</Text>
            </Pressable>
            <Pressable style={styles.solidBtn} onPress={() => router.push('/auth/login')} accessibilityRole="button">
              <Text style={styles.solidBtnText}>Masuk</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

/** Grey strip under the top bar showing the active city; opens the shared picker. */
export function CityBar({ city, cities, total }: { city: string; cities: [string, number][]; total: number }) {
  const insets = useSafeAreaInsets();
  const open = useCityStore((s) => s.pickerOpen);
  const openPicker = useCityStore((s) => s.openPicker);
  const setCity = useCityStore((s) => s.setCity);
  return (
    <>
      <Pressable style={styles.cityBar} onPress={() => { tap(); openPicker(true); }} accessibilityRole="button" accessibilityLabel={`Kota: ${city}. Ganti kota`}>
        <Ionicons name="location" size={15} color="#3F3F46" />
        <Text style={styles.cityText}>{city}</Text>
        <Ionicons name="chevron-down" size={15} color="#3F3F46" />
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => openPicker(false)}>
        <Pressable style={styles.backdrop} onPress={() => openPicker(false)} accessibilityLabel="Tutup pilihan kota" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Pilih kota</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {[[ALL_CITIES, total] as [string, number], ...cities].map(([name, count]) => {
              const on = name === city;
              return (
                <Pressable
                  key={name}
                  onPress={() => { tap(); setCity(name); }}
                  style={({ pressed }) => [styles.cityRow, pressed && { backgroundColor: '#F4F4F5' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Ionicons name={name === ALL_CITIES ? 'globe-outline' : 'location-outline'} size={20} color={on ? ACCENT : '#52525B'} />
                  <Text style={[styles.cityRowText, on && { color: ACCENT }]}>{name}</Text>
                  <Text style={styles.cityRowCount}>{count} acara</Text>
                  {on ? <Ionicons name="checkmark" size={20} color={ACCENT} /> : <View style={{ width: 20 }} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

/** Section title with a gold rule, optional subtitle and a "see all" link. */
export function SectionHeader({ title, subtitle, actionLabel = 'Lihat semua', onAction }: {
  title: string; subtitle?: string; actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.rule} />
      <View style={{ flex: 1 }}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle} numberOfLines={1}>{title}</Text>
          {onAction ? (
            <Pressable onPress={() => { tap(); onAction(); }} hitSlop={10} accessibilityRole="button" style={styles.seeAll}>
              <Text style={styles.seeAllText}>{actionLabel}</Text>
              <Ionicons name="chevron-forward" size={14} color={ACCENT} />
            </Pressable>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function DottedDivider() {
  return <View style={styles.dotted} />;
}

/** Back arrow + large title, for screens pushed above the tabs or tab roots (no back). */
export function PageHeader({ title, back = false, right }: { title: string; back?: boolean; right?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={styles.pageHead}>
      {back ? (
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Kembali" style={{ marginRight: 12 }}>
          <Ionicons name="arrow-back" size={24} color={INK} />
        </Pressable>
      ) : null}
      <Text style={styles.pageTitle} numberOfLines={1}>{title}</Text>
      {right}
    </View>
  );
}

/** Two or more pill tabs; the active one is solid ink. */
export function PillTabs<T extends string>({ value, onChange, items }: {
  value: T; onChange: (v: T) => void; items: { value: T; label: string }[];
}) {
  return (
    <View style={styles.pills}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <Pressable
            key={it.value}
            onPress={() => { tap(); onChange(it.value); }}
            style={[styles.pill, on && styles.pillOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.pillText, on && styles.pillTextOn]} numberOfLines={1}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10, backgroundColor: INK },
  wordmark: { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  outlineBtn: { height: 38, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center' },
  outlineBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  solidBtn: { height: 38, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  solidBtnText: { color: INK, fontWeight: '800', fontSize: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: INK, fontWeight: '900', fontSize: 15 },

  cityBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 40, backgroundColor: '#E4E4E7' },
  cityText: { fontSize: 14, fontWeight: '700', color: '#3F3F46' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 12 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, backgroundColor: '#D4D4D8', marginBottom: 12 },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: INK, paddingHorizontal: 8, marginBottom: 8 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 8, borderRadius: 12 },
  cityRowText: { flex: 1, fontSize: 15, fontWeight: '600', color: INK },
  cityRowCount: { fontSize: 13, color: '#A1A1AA', fontWeight: '600' },

  sectionHead: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 14 },
  rule: { width: 4, borderRadius: 2, backgroundColor: GOLD },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { flexShrink: 1, fontSize: 22, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  sectionSub: { fontSize: 14, color: MUTED, marginTop: 2 },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 14, fontWeight: '700', color: ACCENT },

  dotted: { marginHorizontal: 16, marginVertical: 24, borderBottomWidth: 2, borderStyle: 'dotted', borderColor: '#F5C77A' },

  pageHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  pageTitle: { flex: 1, fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5 },

  pills: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 16 },
  pill: { flex: 1, height: 48, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E4E4E7', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  pillOn: { backgroundColor: INK, borderColor: INK },
  pillText: { fontSize: 15, fontWeight: '700', color: '#3F3F46' },
  pillTextOn: { color: '#FFFFFF' },
});
