import { apiEnvelope, apiFetch } from './api';
export interface OrderItem {
  id: string; eventId: string; quantity: number; totalPrice: string | number;
  status: 'pending' | 'verified' | 'rejected' | 'expired'; createdAt: string;
  event?: { id: string; title: string; dateTime: string; imageUrl?: string | null; venue?: { name: string; city: string } };
  category?: { name: string };
}
export interface OrderSummary { totalOrders: number; activeTickets: number; verified: number; pending: number; rejected: number; expired: number }
export const emptySummary: OrderSummary = { totalOrders: 0, activeTickets: 0, verified: 0, pending: 0, rejected: 0, expired: 0 };
export type OrderFilter = 'all' | 'verified' | 'pending' | 'failed' | 'active';
export async function fetchOrderPage(page: number, filter: OrderFilter, signal?: AbortSignal) {
  const result = await apiEnvelope<OrderItem[]>(`/orders/me?page=${page}&limit=20${filter !== 'all' ? `&status=${filter}` : ''}`, { signal });
  if (!Array.isArray(result.data) || !result.pagination) throw new Error('Respons daftar pesanan tidak lengkap.');
  return { items: result.data, pagination: result.pagination };
}
export const fetchOrderSummary = (signal?: AbortSignal) => apiFetch<OrderSummary>('/orders/me/summary', { signal });
