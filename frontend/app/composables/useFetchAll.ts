/**
 * Loads every page of a paginated list endpoint. Dropdown options used to fetch a
 * single `limit: 100` page, so the 101st artist/venue/event silently went missing.
 */
export function useFetchAll() {
  const { request } = useApi()

  return async function fetchAll<T>(path: string, query: Record<string, unknown> = {}): Promise<T[]> {
    const items: T[] = []
    for (let page = 1; ; page++) {
      const res = await request<{ data: T[], pagination?: { totalPages: number } }>(path, { query: { ...query, page, limit: 100 } })
      items.push(...res.data)
      if (!res.pagination || page >= res.pagination.totalPages || res.data.length === 0) return items
    }
  }
}
