const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

export type UploadKind = 'profile' | 'banner' | 'venue'

/** Uploads one image to /uploads. Validates type and size before sending. */
export function useImageUpload() {
  const { request } = useApi()
  const uploading = ref(false)
  const error = ref('')

  async function upload(file: File | null | undefined, kind: UploadKind): Promise<string | null> {
    error.value = ''
    if (!file) return null
    if (!ACCEPTED.includes(file.type)) {
      error.value = 'Format harus PNG, JPG, atau WebP.'
      return null
    }
    if (file.size > MAX_BYTES) {
      error.value = 'Ukuran file maksimal 10 MB.'
      return null
    }
    uploading.value = true
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('kind', kind)
      const res = await request<{ data: { url: string } }>('/uploads', { method: 'POST', body: form })
      return res.data.url
    } catch (err) {
      error.value = apiErrorMessage(err, 'Gambar gagal diunggah.')
      return null
    } finally {
      uploading.value = false
    }
  }

  return { upload, uploading, error, accept: ACCEPTED.join(',') }
}
