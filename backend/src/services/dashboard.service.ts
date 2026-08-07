import * as dashboardRepo from "../repositories/dashboard.repository";

export interface DashboardQuery {
  days?: number;
  from?: string;
  to?: string;
}

export async function getSummary(query: DashboardQuery = {}) {
  return await dashboardRepo.getDashboardSummary(query);
}

export async function getTrend(query: DashboardQuery = {}) {
  return await dashboardRepo.getDashboardTrend(query);
}

export async function getEvents(eventId?: string) {
  return await dashboardRepo.getDashboardEvents(eventId);
}
