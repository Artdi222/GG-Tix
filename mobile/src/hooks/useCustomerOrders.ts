import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../store/auth-store';
import { session } from '../services/session';
import { ApiError } from '../services/api';
import { emptySummary, fetchOrderPage, fetchOrderSummary, type OrderFilter, type OrderItem, type OrderSummary } from '../services/orders';

export function useCustomerOrders(filter: OrderFilter) {
  const userId = useAuthStore(s => s.user?.id);
  const [loadedFor, setLoadedFor] = useState('');
  const [state, setState] = useState({ items: [] as OrderItem[], summary: emptySummary, page: 0, totalPages: 0, offline: false, error: '', loading: true });
  const controller = useRef<AbortController | null>(null);
  const load = useCallback(async (page = 1) => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const revision = session.snapshot().revision;
    const current = () => !abort.signal.aborted && session.snapshot().revision === revision;
    if (!userId) { setState({ items: [], summary: emptySummary, page: 0, totalPages: 0, offline: false, error: '', loading: false }); return; }
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const [result, summary] = await Promise.all([fetchOrderPage(page, filter, abort.signal), fetchOrderSummary(abort.signal)]);
      if (!current()) return;
      setLoadedFor(`${userId}:${filter}`);
      setState(s => ({ items: page === 1 ? result.items : [...s.items, ...result.items.filter(item => !s.items.some(old => old.id === item.id))], summary, page, totalPages: result.pagination.totalPages, offline: false, error: '', loading: false }));
      // Cache a complete page, including metadata; never present a partial cache as all orders.
      await session.cacheWrite(`orders:${filter}:${page}`, { result, summary }, revision).catch(() => {});
    } catch (error) {
      if (!current()) return;
      if (error instanceof ApiError && error.offline) {
        const cached = await session.cacheRead<{ result: Awaited<ReturnType<typeof fetchOrderPage>>; summary: OrderSummary }>(`orders:${filter}:${page}`, revision).catch(() => null);
        if (!current()) return;
        if (cached) {
          setLoadedFor(`${userId}:${filter}`);
          setState(s => ({ items: page === 1 ? cached.result.items : [...s.items, ...cached.result.items.filter(item => !s.items.some(old => old.id === item.id))], summary: cached.summary, page, totalPages: cached.result.pagination.totalPages, offline: true, error: '', loading: false }));
          return;
        }
      }
      setState(s => ({ ...s, items: page === 1 ? [] : s.items, loading: false, error: error instanceof Error ? error.message : 'Pesanan gagal dimuat.' }));
    }
  }, [userId, filter]);
  useFocusEffect(useCallback(() => {
    setState({ items: [], summary: emptySummary, page: 0, totalPages: 0, offline: false, error: '', loading: true });
    void load();
    return () => controller.current?.abort();
  }, [load]));
  return { ...state, items: loadedFor === `${userId}:${filter}` ? state.items : [], summary: loadedFor === `${userId}:${filter}` ? state.summary : emptySummary, reload: () => load(1), loadMore: () => { if (!state.loading && state.page < state.totalPages) void load(state.page + 1); } };
}
