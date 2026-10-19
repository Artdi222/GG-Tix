interface ZodIssue { path?: (string | number)[], message?: string }

/**
 * Human-readable message from any API failure. The backend returns
 * { error: string } for app errors, { success: false, error: { issues } } for
 * request validation, and { error, message } for check-in results.
 */
export function apiErrorMessage(err: unknown, fallback = 'Terjadi kesalahan. Coba lagi.') {
  const e = err as { data?: Record<string, unknown>, statusCode?: number, status?: number, message?: string }
  const data = e?.data

  if (data) {
    if (typeof data.message === 'string' && data.message) return data.message
    if (typeof data.error === 'string' && data.error) return data.error
    const issues = (data.error as { issues?: ZodIssue[] } | undefined)?.issues
    if (Array.isArray(issues) && issues.length) {
      const first = issues[0]!
      const field = first.path?.length ? `${first.path.join('.')}: ` : ''
      return `${field}${first.message ?? 'Data tidak valid'}`
    }
  }

  const status = apiErrorStatus(err)
  if (status === 403) return 'Anda tidak memiliki akses untuk tindakan ini.'
  if (status === 404) return 'Data tidak ditemukan. Mungkin sudah dihapus.'
  if (status === 429) return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.'
  if (!status) return 'Tidak dapat terhubung ke server. Periksa koneksi Anda.'
  return fallback
}

export function apiErrorStatus(err: unknown): number | undefined {
  const e = err as { statusCode?: number, status?: number, response?: { status?: number } }
  return e?.statusCode ?? e?.status ?? e?.response?.status
}
