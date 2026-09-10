import { API_BASE_URL } from '../constants/config';
import { createHttpClient } from './http-client';
import { session } from './session';
export { storage } from './storage';
export { ApiError } from './http-client';

export interface ApiResponse<T = any> {
  message?: string;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  error?: string;
  payment?: {
    snapToken?: string;
    redirectUrl?: string;
  };
}

const request = createHttpClient(API_BASE_URL, session);
export function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  return request(endpoint, options);
}
export function apiEnvelope<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  return request(endpoint, options, true);
}
