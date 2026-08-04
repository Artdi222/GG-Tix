import * as dashboardRepo from "../repositories/dashboard.repository";

export async function getSummary() {
  return await dashboardRepo.getDashboardSummary();
}
