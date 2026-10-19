import type { MaybeRefOrGetter } from 'vue'

export interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

interface Options {
  /** Extra query params (filters). Changing them resets to page 1. */
  query?: MaybeRefOrGetter<Record<string, unknown>>
  limit?: number
  /** Name of the backend search param; the search ref is debounced. */
  searchParam?: string
  immediate?: boolean
}

/**
 * Server-paginated list with debounced search. Superseded requests are aborted,
 * so a slow earlier response can never overwrite a newer one.
 */
export function usePaginatedList<T>(endpoint: MaybeRefOrGetter<string>, options: Options = {}) {
  const { request } = useApi()
  const limit = options.limit ?? 20

  const items = ref<T[]>([]) as Ref<T[]>
  const page = ref(1)
  const search = ref('')
  const debouncedSearch = ref('')
  const totalCount = ref(0)
  const totalPages = ref(0)
  const loading = ref(false)
  const error = ref('')
  let controller: AbortController | null = null

  async function refresh() {
    controller?.abort()
    const current = new AbortController()
    controller = current
    loading.value = true
    error.value = ''
    try {
      const res = await request<{ data: T[], pagination?: Pagination }>(toValue(endpoint), {
        signal: current.signal,
        query: {
          ...toValue(options.query),
          ...(options.searchParam && debouncedSearch.value.trim() ? { [options.searchParam]: debouncedSearch.value.trim() } : {}),
          page: page.value,
          limit
        }
      })
      items.value = res.data ?? []
      totalCount.value = res.pagination?.totalCount ?? items.value.length
      totalPages.value = res.pagination?.totalPages ?? 1
      // A deletion can leave us past the last page.
      if (page.value > 1 && items.value.length === 0 && totalPages.value > 0 && page.value > totalPages.value) {
        page.value = totalPages.value
      }
    } catch (err) {
      if (current.signal.aborted) return
      items.value = []
      error.value = apiErrorMessage(err, 'Data gagal dimuat.')
    } finally {
      if (controller === current) loading.value = false
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  watch(search, (value) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      debouncedSearch.value = value
    }, 300)
  })

  watch([debouncedSearch, () => JSON.stringify(toValue(options.query) ?? {})], () => {
    if (page.value !== 1) page.value = 1
    else refresh()
  })
  watch(page, refresh)

  onBeforeUnmount(() => {
    clearTimeout(timer)
    controller?.abort()
  })

  if (options.immediate !== false) onMounted(refresh)

  return { items, page, limit, search, totalCount, totalPages, loading, error, refresh }
}
