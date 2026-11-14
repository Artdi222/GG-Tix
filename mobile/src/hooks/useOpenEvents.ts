import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiEnvelope } from '../services/api';
import { collectPages } from '../services/pagination';
import { isEventOver, type EventItem } from '../components/EventCard';
import { ALL_CITIES, useCityStore } from '../store/city-store';

interface Snapshot { events: EventItem[]; loading: boolean; error: string | null }

// Shared across screens so Home, the event list and the city picker don't each refetch.
let snapshot: Snapshot = { events: [], loading: true, error: null };
let inflight: Promise<void> | null = null;
let loadedOnce = false;
const listeners = new Set<(s: Snapshot) => void>();
const publish = (next: Partial<Snapshot>) => {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l(snapshot));
};

export function reloadOpenEvents(): Promise<void> {
  if (inflight) return inflight;
  inflight = collectPages<EventItem>((page) => apiEnvelope<EventItem[]>(`/events?status=open&page=${page}&limit=100`))
    .then((items) => {
      // Sales can stay "open" after the show; past events are not something to buy.
      const upcoming = items.filter((e) => !isEventOver(e)).sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime));
      loadedOnce = true;
      publish({ events: upcoming, loading: false, error: null });
    })
    .catch((err: any) => publish({ loading: false, error: err?.message || 'Gagal memuat daftar konser.' }))
    .finally(() => { inflight = null; });
  return inflight;
}

export const cityOf = (e: EventItem) => e.venue?.city?.trim() || '';

export function useOpenEvents() {
  const [state, setState] = useState(snapshot);
  const city = useCityStore((s) => s.city);

  useEffect(() => {
    listeners.add(setState);
    if (!loadedOnce) void reloadOpenEvents();
    return () => { listeners.delete(setState); };
  }, []);

  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of state.events) {
      const c = cityOf(e);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [state.events]);

  // A remembered city that no longer has events falls back to everything instead of an empty screen.
  const activeCity = city === ALL_CITIES || cities.some(([c]) => c === city) ? city : ALL_CITIES;
  const inCity = useMemo(
    () => (activeCity === ALL_CITIES ? state.events : state.events.filter((e) => cityOf(e) === activeCity)),
    [state.events, activeCity]
  );

  const reload = useCallback(() => reloadOpenEvents(), []);
  return { ...state, cities, activeCity, inCity, reload };
}
