import { describe, expect, it } from 'vitest'
import { apiErrorMessage, apiErrorStatus } from '~/utils/api-error'

describe('apiErrorMessage', () => {
  it('prefers the server message', () => {
    expect(apiErrorMessage({ statusCode: 400, data: { error: 'Kuota habis' } })).toBe('Kuota habis')
    expect(apiErrorMessage({ statusCode: 400, data: { message: 'Pesan' } })).toBe('Pesan')
  })

  it('formats zod issues with their field path', () => {
    const err = { statusCode: 400, data: { success: false, error: { issues: [{ path: ['quotaTotal'], message: 'Too small' }] } } }
    expect(apiErrorMessage(err)).toBe('quotaTotal: Too small')
  })

  it('never renders [object Object]', () => {
    const msg = apiErrorMessage({ statusCode: 422, data: { error: { unexpected: true } } }, 'Gagal')
    expect(msg).toBe('Gagal')
  })

  it.each([
    [403, 'Anda tidak memiliki akses untuk tindakan ini.'],
    [404, 'Data tidak ditemukan. Mungkin sudah dihapus.'],
    [429, 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.']
  ])('status %i has a human fallback', (status, expected) => {
    expect(apiErrorMessage({ statusCode: status })).toBe(expected)
  })

  it('network failures (no status) say so', () => {
    expect(apiErrorMessage(new TypeError('fetch failed'))).toBe('Tidak dapat terhubung ke server. Periksa koneksi Anda.')
  })

  it('reads the status from any of the shapes ofetch produces', () => {
    expect(apiErrorStatus({ statusCode: 401 })).toBe(401)
    expect(apiErrorStatus({ status: 409 })).toBe(409)
    expect(apiErrorStatus({ response: { status: 500 } })).toBe(500)
    expect(apiErrorStatus(null)).toBeUndefined()
  })
})
