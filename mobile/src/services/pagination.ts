export interface Page<T> { data?: T[]; pagination?: { page: number; totalPages: number } }
// Public catalog filters operate locally, so load every API page before counting cities.
export async function collectPages<T extends { id: string }>(fetchPage: (page: number) => Promise<Page<T>>): Promise<T[]> {
  const items = new Map<string, T>();
  let page = 1;
  do {
    const result = await fetchPage(page);
    if (!Array.isArray(result.data) || !result.pagination || result.pagination.page !== page || !Number.isInteger(result.pagination.totalPages)) {
      throw new Error('Respons daftar tidak lengkap. Silakan coba lagi.');
    }
    for (const item of result.data) items.set(item.id, item);
    if (page >= result.pagination.totalPages) break;
    if (!result.data.length) throw new Error('Daftar berubah saat dimuat. Silakan coba lagi.');
    page++;
  } while (true);
  return [...items.values()];
}
