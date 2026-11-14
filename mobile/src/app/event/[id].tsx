import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { apiFetch } from '../../services/api';
import { useAuthStore } from '../../store/auth-store';
import { formatRupiah, getPosterImage, isEventOver } from '../../components/EventCard';
import type { TicketCategoryItem } from '../../components/CategoryCard';
import { LinearGradient } from '../../components/LinearGradient';

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
  artist?: { id: string; name: string; bio?: string | null; photoUrl?: string | null } | null;
  venue?: { id: string; name: string; city: string; address: string } | null;
  ticketCategories?: TicketCategoryItem[];
}

const INK = '#18181B';
const MUTED = '#71717A';
const ACCENT = '#B4630A';

const tap = (style: 'light' | 'select' = 'select') => {
  if (Platform.OS === 'web') return;
  (style === 'light' ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) : Haptics.selectionAsync()).catch(() => {});
};

const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', ...opts });

function durationLabel(start: string, end?: string | null) {
  if (!end) return null;
  const mins = Math.round((+new Date(end) - +new Date(start)) / 60000);
  if (!(mins > 0)) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}j${m ? ` ${m}m` : ''}` : `${m}m`;
}

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);

  const [event, setEvent] = useState<EventDetailData | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [seatmapOpen, setSeatmapOpen] = useState(false);
  const [seatmapFull, setSeatmapFull] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    apiFetch<any>(`/events/${id}`)
      .then((res) => {
        if (!alive) return;
        const data: EventDetailData = res?.data || res;
        setEvent(data);
        // Open the first category that still has seats, like a showtime list opens the first cinema.
        const first = [...(data.ticketCategories ?? [])]
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || Number(a.price) - Number(b.price))
          .find((c) => Number(c.quotaRemaining) > 0);
        setOpenId(first?.id ?? null);
      })
      .catch((err: any) => {
        if (alive) setLoadError(err?.status === 404 ? '' : err?.message || 'Gagal memuat detail konser.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id, reloadKey]);

  const categories = useMemo(
    () => [...(event?.ticketCategories ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || Number(a.price) - Number(b.price)),
    [event]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.center, { paddingHorizontal: 32 }]}>
        <Ionicons name="cloud-offline-outline" size={40} color={MUTED} />
        <Text style={styles.centerText}>{loadError || 'Konser tidak ditemukan atau sudah dihapus.'}</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
          <Pressable style={styles.ghostBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button">
            <Text style={styles.ghostBtnText}>Kembali</Text>
          </Pressable>
          {loadError ? (
            <Pressable style={styles.inkBtnSmall} onPress={() => { setLoadError(''); setLoading(true); setReloadKey((k) => k + 1); }} accessibilityRole="button">
              <Text style={styles.inkBtnText}>Coba lagi</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const poster = getPosterImage(event as any);
  const isOver = isEventOver(event);
  const closedReason = isOver
    ? 'Acara ini sudah berlangsung'
    : event.status !== 'open'
      ? 'Penjualan tiket ditutup'
      : event.maintenanceMode
        ? 'Pemesanan sedang dalam pemeliharaan'
        : null;
  const selected = categories.find((c) => c.id === openId && Number(c.quotaRemaining) > 0) ?? null;
  const maxQty = selected ? Math.max(1, Math.min(event.maxTicketsPerOrder || 4, Number(selected.quotaRemaining))) : 1;
  const qty = Math.min(quantity, maxQty);
  const total = selected ? Number(selected.price) * qty : 0;
  const duration = durationLabel(event.dateTime, event.endDateTime);

  const toggleCategory = (cat: TicketCategoryItem) => {
    tap();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((cur) => (cur === cat.id ? null : cat.id));
    setQuantity(1);
  };

  const checkout = () => {
    if (closedReason || !selected) return;
    tap('light');
    if (!token) {
      router.push({ pathname: '/auth/login', params: { redirect: `/event/${id}` } });
      return;
    }
    router.push({
      pathname: '/checkout/[id]',
      params: { id: String(id), categoryId: selected.id, qty: String(qty), price: String(selected.price), categoryName: selected.name },
    });
  };

  const share = () => {
    Share.share({ title: event.title, message: `${event.title} — tiket tersedia di GG-Tix.` }).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }} showsVerticalScrollIndicator={false}>
        {/* Backdrop: the poster blurred behind a sharp thumbnail, title and quick facts. */}
        <View style={styles.hero}>
          <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={24} />
          <LinearGradient
            // Dark only behind the top buttons; the title sits on near-white so any poster stays readable.
            colors={['rgba(9,9,11,0.55)', 'rgba(255,255,255,0.88)', 'rgba(255,255,255,1)']}
            locations={[0, 0.42, 0.7]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
            <Pressable style={styles.roundBtn} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel="Kembali" hitSlop={6}>
              <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable style={styles.roundBtn} onPress={share} accessibilityRole="button" accessibilityLabel="Bagikan" hitSlop={6}>
              <Ionicons name="share-outline" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.heroBody}>
            <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" transition={200} />
            <View style={styles.heroText}>
              <Text style={styles.title} numberOfLines={3}>{event.title}</Text>
              <View style={styles.chips}>
                {event.tags?.[0] ? <Chip label={event.tags[0]} /> : null}
                {event.venue?.city ? <Chip label={event.venue.city} /> : null}
                {duration ? <Chip label={duration} /> : null}
              </View>
              <View style={[styles.status, closedReason ? styles.statusClosed : styles.statusOpen]}>
                <View style={[styles.statusDot, { backgroundColor: closedReason ? '#DC2626' : '#059669' }]} />
                <Text style={[styles.statusText, { color: closedReason ? '#B91C1C' : '#047857' }]}>
                  {isOver ? 'Sudah berlangsung' : closedReason ? 'Penjualan ditutup' : 'Tiket tersedia'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Plain label / value pairs, no boxes. */}
        <View style={styles.facts}>
          <Fact label="Tanggal" value={`${fmt(event.dateTime, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`} />
          <Fact
            label="Waktu"
            value={`${fmt(event.dateTime, { hour: '2-digit', minute: '2-digit' })}${event.endDateTime ? ` – ${fmt(event.endDateTime, { hour: '2-digit', minute: '2-digit' })}` : ''} WIB`}
          />
          {event.venue ? <Fact label="Venue" value={event.venue.name} sub={event.venue.address} /> : null}
          {event.artist ? <Fact label="Penampil" value={event.artist.name} sub={event.artist.bio || undefined} /> : null}
          {event.publisherName ? <Fact label="Promotor" value={event.publisherName} /> : null}
          {event.description ? (
            <View>
              <Text style={styles.factLabel}>Tentang acara</Text>
              <Text style={styles.factBody} numberOfLines={aboutOpen ? undefined : 3}>{event.description}</Text>
              {event.description.length > 140 ? (
                <Pressable onPress={() => setAboutOpen((v) => !v)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.readMore}>{aboutOpen ? 'Tutup' : 'Selengkapnya'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.divider} />

        {/* Ticket categories as an accordion: price and remaining seats at a glance, quantity inside. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pilih tiket</Text>
          {categories.length === 0 ? (
            <Text style={styles.emptyText}>Kategori tiket belum tersedia.</Text>
          ) : (
            categories.map((cat) => {
              const remaining = Number(cat.quotaRemaining);
              const soldOut = remaining <= 0;
              const open = openId === cat.id && !soldOut && !closedReason;
              const low = !soldOut && remaining / Math.max(1, cat.quotaTotal) < 0.15;
              return (
                <View key={cat.id} style={[styles.cat, open && styles.catOpen]}>
                  <Pressable
                    style={styles.catHead}
                    onPress={() => !soldOut && !closedReason && toggleCategory(cat)}
                    disabled={soldOut || !!closedReason}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open, disabled: soldOut || !!closedReason }}
                    accessibilityLabel={`${cat.name}, ${formatRupiah(cat.price)}, ${soldOut ? 'habis' : `sisa ${remaining} kursi`}`}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.catName, soldOut && styles.dim]}>{cat.name}</Text>
                      <Text style={[styles.catPrice, soldOut && styles.dim]}>{formatRupiah(cat.price)}</Text>
                    </View>
                    <View style={[styles.seatBox, soldOut && styles.seatBoxSold]}>
                      <Text style={[styles.seatBig, { color: soldOut ? '#A1A1AA' : low ? '#B45309' : '#059669' }]}>
                        {soldOut ? 'Habis' : remaining}
                      </Text>
                      {!soldOut ? <Text style={styles.seatSmall}>/ {cat.quotaTotal} kursi</Text> : null}
                    </View>
                    {!soldOut && !closedReason ? (
                      <Ionicons name={open ? 'remove' : 'add'} size={22} color={INK} style={{ marginLeft: 12 }} />
                    ) : null}
                  </Pressable>

                  {open ? (
                    <View style={styles.catBody}>
                      {cat.benefits?.length ? (
                        <View style={{ gap: 6, marginBottom: 14 }}>
                          {cat.benefits.map((b) => (
                            <View key={b} style={styles.benefit}>
                              <Ionicons name="checkmark" size={16} color={ACCENT} />
                              <Text style={styles.benefitText}>{b}</Text>
                            </View>
                          ))}
                        </View>
                      ) : null}
                      <View style={styles.qtyRow}>
                        <View>
                          <Text style={styles.qtyLabel}>Jumlah</Text>
                          <Text style={styles.qtyHint}>Maks. {maxQty} per pesanan</Text>
                        </View>
                        <View style={styles.stepper}>
                          <Pressable
                            style={[styles.stepBtn, qty <= 1 && styles.stepBtnOff]}
                            onPress={() => { tap(); setQuantity(Math.max(1, qty - 1)); }}
                            disabled={qty <= 1}
                            accessibilityRole="button"
                            accessibilityLabel="Kurangi"
                          >
                            <Ionicons name="remove" size={18} color={INK} />
                          </Pressable>
                          <Text style={styles.qty}>{qty}</Text>
                          <Pressable
                            style={[styles.stepBtn, qty >= maxQty && styles.stepBtnOff]}
                            onPress={() => { tap(); setQuantity(Math.min(maxQty, qty + 1)); }}
                            disabled={qty >= maxQty}
                            accessibilityRole="button"
                            accessibilityLabel="Tambah"
                          >
                            <Ionicons name="add" size={18} color={INK} />
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          {/* Only shown when the organiser uploaded a real seatmap. */}
          {event.seatmapUrl ? (
            <View style={styles.cat}>
              <Pressable
                style={styles.catHead}
                onPress={() => { tap(); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setSeatmapOpen((v) => !v); }}
                accessibilityRole="button"
                accessibilityState={{ expanded: seatmapOpen }}
              >
                <Ionicons name="map-outline" size={20} color={INK} style={{ marginRight: 12 }} />
                <Text style={[styles.catName, { flex: 1 }]}>Denah venue</Text>
                <Ionicons name={seatmapOpen ? 'remove' : 'add'} size={22} color={INK} />
              </Pressable>
              {seatmapOpen ? (
                <Pressable onPress={() => setSeatmapFull(true)} style={styles.catBody} accessibilityRole="button" accessibilityLabel="Perbesar denah">
                  <Image source={{ uri: event.seatmapUrl }} style={styles.seatmap} contentFit="contain" />
                  <Text style={styles.qtyHint}>Ketuk untuk memperbesar</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {closedReason ? (
          <View style={styles.footerClosed}>
            <Ionicons name={isOver ? 'time-outline' : 'lock-closed-outline'} size={18} color="#52525B" />
            <Text style={styles.footerClosedText}>{closedReason}</Text>
          </View>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.footerLabel} numberOfLines={1}>
                {selected ? `${selected.name} · ${qty} tiket` : 'Pilih kategori tiket'}
              </Text>
              <Text style={styles.footerTotal}>{selected ? formatRupiah(total) : '—'}</Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.buyBtn, !selected && styles.buyBtnOff, pressed && selected && { opacity: 0.85 }]}
              onPress={checkout}
              disabled={!selected}
              accessibilityRole="button"
              accessibilityLabel="Beli tiket"
            >
              <Text style={styles.buyText}>Beli tiket</Text>
            </Pressable>
          </>
        )}
      </View>

      <Modal visible={seatmapFull} transparent animationType="fade" onRequestClose={() => setSeatmapFull(false)}>
        <View style={styles.fullBg}>
          {event.seatmapUrl ? <Image source={{ uri: event.seatmapUrl }} style={StyleSheet.absoluteFill} contentFit="contain" /> : null}
          <Pressable style={[styles.roundBtn, { position: 'absolute', top: insets.top + 12, right: 16 }]} onPress={() => setSeatmapFull(false)} accessibilityRole="button" accessibilityLabel="Tutup">
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

function Chip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
      {sub ? <Text style={styles.factSub} numberOfLines={2}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  centerText: { marginTop: 12, fontSize: 15, color: '#52525B', textAlign: 'center' },
  ghostBtn: { height: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, borderColor: '#D4D4D8', justifyContent: 'center' },
  ghostBtnText: { color: INK, fontWeight: '700' },
  inkBtnSmall: { height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: INK, justifyContent: 'center' },
  inkBtnText: { color: '#FFFFFF', fontWeight: '700' },

  hero: { paddingBottom: 20, overflow: 'hidden', backgroundColor: '#27272A' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 20 },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  heroBody: { flexDirection: 'row', gap: 16, paddingHorizontal: 20, alignItems: 'flex-end' },
  poster: { width: 112, height: 160, borderRadius: 12, backgroundColor: '#3F3F46' },
  heroText: { flex: 1, gap: 10, paddingBottom: 2 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '800', color: INK, letterSpacing: -0.4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1.5, borderColor: INK, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 3, maxWidth: 140 },
  chipText: { fontSize: 12, fontWeight: '700', color: INK },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusOpen: { backgroundColor: 'rgba(5,150,105,0.12)' },
  statusClosed: { backgroundColor: 'rgba(220,38,38,0.10)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },

  facts: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  factLabel: { fontSize: 15, fontWeight: '800', color: INK, marginBottom: 2 },
  factValue: { fontSize: 15, color: '#3F3F46', lineHeight: 21 },
  factSub: { fontSize: 13, color: MUTED, lineHeight: 18, marginTop: 2 },
  factBody: { fontSize: 15, color: '#3F3F46', lineHeight: 22 },
  readMore: { marginTop: 4, fontSize: 14, fontWeight: '700', color: ACCENT },

  divider: { height: 8, backgroundColor: '#F4F4F5', marginTop: 24 },
  section: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: INK, paddingHorizontal: 4, marginBottom: 4 },
  emptyText: { fontSize: 14, color: MUTED, paddingHorizontal: 4 },

  cat: { borderWidth: 1, borderColor: '#E4E4E7', borderRadius: 14, backgroundColor: '#FFFFFF' },
  catOpen: { borderColor: INK },
  catHead: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 72, paddingVertical: 12 },
  catName: { fontSize: 16, fontWeight: '800', color: INK },
  catPrice: { fontSize: 14, fontWeight: '600', color: '#52525B', marginTop: 2 },
  dim: { color: '#A1A1AA' },
  seatBox: { borderWidth: 1, borderColor: '#E4E4E7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 76 },
  seatBoxSold: { backgroundColor: '#F4F4F5', borderColor: '#F4F4F5' },
  seatBig: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  seatSmall: { fontSize: 11, color: MUTED, fontVariant: ['tabular-nums'] },
  catBody: { borderTopWidth: 1, borderTopColor: '#F4F4F5', padding: 16 },
  benefit: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  benefitText: { flex: 1, fontSize: 14, color: '#3F3F46', lineHeight: 20 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyLabel: { fontSize: 15, fontWeight: '700', color: INK },
  qtyHint: { fontSize: 12, color: MUTED, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4F4F5', borderRadius: 22, padding: 4 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  stepBtnOff: { opacity: 0.35 },
  qty: { minWidth: 32, textAlign: 'center', fontSize: 16, fontWeight: '800', color: INK, fontVariant: ['tabular-nums'] },
  seatmap: { width: '100%', height: 220, borderRadius: 10, backgroundColor: '#F4F4F5', marginBottom: 6 },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E4E4E7' },
  footerLabel: { fontSize: 12, color: MUTED, fontWeight: '600' },
  footerTotal: { fontSize: 20, fontWeight: '800', color: INK, fontVariant: ['tabular-nums'], marginTop: 1 },
  footerClosed: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 52 },
  footerClosedText: { fontSize: 15, fontWeight: '700', color: '#3F3F46' },
  buyBtn: { height: 52, paddingHorizontal: 32, borderRadius: 26, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' },
  buyBtnOff: { backgroundColor: '#D4D4D8' },
  buyText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

  fullBg: { flex: 1, backgroundColor: '#000000' },
});

