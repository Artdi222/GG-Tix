<script setup lang="ts">
export interface Voucher {
  id?: string
  code: string
  name: string
  description?: string | null
  discountType: 'fixed' | 'percentage'
  discountValue: string
  maxDiscountAmount?: string | null
  minOrderAmount: string
  quotaTotal: number
  quotaRemaining?: number
  maxUsagePerCustomer: number
  eventId?: string | null
  event?: { id: string; title: string } | null
  startDate?: string | null
  endDate: string
  isActive: boolean
}

const props = defineProps<{
  open: boolean
  voucher?: Voucher | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  saved: [voucher: Voucher]
}>()

const { request } = useApi()

const isEdit = computed(() => !!props.voucher?.id)

const state = reactive({
  code: '',
  name: '',
  description: '',
  discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: 10,
  maxDiscountAmount: '' as string | number,
  minOrderAmount: 0 as string | number,
  quotaTotal: 100,
  maxUsagePerCustomer: 1,
  eventId: '',
  startDate: '',
  endDate: '',
  isActive: true
})

const isSaving = ref(false)
const errorMessage = ref('')
const eventsList = ref<Array<{ id: string; title: string }>>([])

// Format ISO date to YYYY-MM-DDTHH:mm for datetime-local input
function toLocalDatetimeString(isoDate?: string | null): string {
  if (!isoDate) return ''
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return ''
  const tzOffset = d.getTimezoneOffset() * 60000
  const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
  return localISOTime
}

async function fetchEvents() {
  try {
    const res = await request<{ data: Array<{ id: string; title: string }> }>('/events?limit=100')
    if (res?.data) {
      eventsList.value = res.data
    }
  } catch {
    // Ignore error
  }
}

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    errorMessage.value = ''
    if (eventsList.value.length === 0) {
      fetchEvents()
    }

    if (props.voucher) {
      state.code = props.voucher.code
      state.name = props.voucher.name
      state.description = props.voucher.description || ''
      state.discountType = props.voucher.discountType
      state.discountValue = Number(props.voucher.discountValue)
      state.maxDiscountAmount = props.voucher.maxDiscountAmount ? Number(props.voucher.maxDiscountAmount) : ''
      state.minOrderAmount = Number(props.voucher.minOrderAmount) || 0
      state.quotaTotal = props.voucher.quotaTotal
      state.maxUsagePerCustomer = props.voucher.maxUsagePerCustomer || 1
      state.eventId = props.voucher.eventId || ''
      state.startDate = toLocalDatetimeString(props.voucher.startDate)
      state.endDate = toLocalDatetimeString(props.voucher.endDate)
      state.isActive = props.voucher.isActive
    } else {
      state.code = ''
      state.name = ''
      state.description = ''
      state.discountType = 'percentage'
      state.discountValue = 10
      state.maxDiscountAmount = ''
      state.minOrderAmount = 0
      state.quotaTotal = 100
      state.maxUsagePerCustomer = 1
      state.eventId = ''
      state.startDate = ''
      // Default end date: 30 days from now
      const defaultEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      state.endDate = toLocalDatetimeString(defaultEnd.toISOString())
      state.isActive = true
    }
  }
)

async function onSubmit() {
  if (!state.code.trim()) {
    errorMessage.value = 'Kode voucher harus diisi.'
    return
  }
  if (!state.name.trim()) {
    errorMessage.value = 'Nama promo harus diisi.'
    return
  }
  if (!state.endDate) {
    errorMessage.value = 'Tanggal berakhir harus ditentukan.'
    return
  }
  if (Number(state.discountValue) <= 0) {
    errorMessage.value = 'Nilai diskon harus lebih besar dari 0.'
    return
  }

  isSaving.value = true
  errorMessage.value = ''

  try {
    const payload: Record<string, any> = {
      code: state.code.trim().toUpperCase(),
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      discountType: state.discountType,
      discountValue: Number(state.discountValue).toFixed(2),
      maxDiscountAmount: state.maxDiscountAmount && Number(state.maxDiscountAmount) > 0
        ? Number(state.maxDiscountAmount).toFixed(2)
        : null,
      minOrderAmount: Number(state.minOrderAmount || 0).toFixed(2),
      quotaTotal: Number(state.quotaTotal),
      maxUsagePerCustomer: Number(state.maxUsagePerCustomer) || 1,
      eventId: state.eventId || null,
      startDate: state.startDate ? new Date(state.startDate).toISOString() : undefined,
      endDate: new Date(state.endDate).toISOString(),
      isActive: state.isActive
    }

    if (props.voucher?.id) {
      const res = await request<{ data: Voucher }>(`/vouchers/${props.voucher.id}`, {
        method: 'PUT',
        body: payload
      })
      emit('saved', res?.data || { id: props.voucher.id, ...payload } as any)
    } else {
      const res = await request<{ data: Voucher }>('/vouchers', {
        method: 'POST',
        body: payload
      })
      emit('saved', res?.data || { id: `voucher-${Date.now()}`, ...payload } as any)
    }
    emit('update:open', false)
  } catch (err: any) {
    errorMessage.value = err?.data?.error || err?.data?.message || err?.message || 'Gagal menyimpan voucher.'
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? 'Edit Voucher Promo' : 'Buat Voucher Promo Baru'"
    :description="isEdit ? 'Perbarui konfigurasi diskon, kuota, atau masa berlaku promo.' : 'Tambahkan kode promo baru untuk potongan harga tiket.'"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <form class="space-y-4" @submit.prevent="onSubmit">
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :description="errorMessage"
        />

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Kode Promo" required help="Gunakan huruf kapital & angka tanpa spasi (misal: GGTIX2026)">
            <UInput
              v-model="state.code"
              placeholder="CONTOH: EARLYBIRD"
              class="w-full uppercase font-mono tracking-wider font-bold"
              @input="state.code = state.code.toUpperCase().replace(/\s+/g, '')"
            />
          </UFormField>

          <UFormField label="Nama Promo / Kampanye" required>
            <UInput v-model="state.name" placeholder="Contoh: Diskon Launching 20%" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Deskripsi / Catatan Syarat & Ketentuan">
          <UInput v-model="state.description" placeholder="Opsional: Keterangan promo..." class="w-full" />
        </UFormField>

        <!-- Tipe & Nilai Diskon -->
        <div class="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700/60 space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField label="Tipe Diskon" required>
              <select
                v-model="state.discountType"
                class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 shadow-xs focus:ring-2 focus:ring-primary-500"
              >
                <option value="percentage">Persentase (%)</option>
                <option value="fixed">Nominal Tetap (Rp)</option>
              </select>
            </UFormField>

            <UFormField
              :label="state.discountType === 'percentage' ? 'Nilai Persentase (%)' : 'Nominal Diskon (Rp)'"
              required
            >
              <UInput
                v-model.number="state.discountValue"
                type="number"
                min="1"
                :max="state.discountType === 'percentage' ? 100 : undefined"
                :placeholder="state.discountType === 'percentage' ? '10' : '50000'"
                class="w-full"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <UFormField
              v-if="state.discountType === 'percentage'"
              label="Maksimal Potongan Diskon (Rp)"
              help="Kosongkan jika tidak ada batas diskon"
            >
              <UInput
                v-model.number="state.maxDiscountAmount"
                type="number"
                placeholder="Contoh: 100000"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Minimal Total Pembelian (Rp)">
              <UInput
                v-model.number="state.minOrderAmount"
                type="number"
                placeholder="0"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <!-- Kuota & Limit -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Total Kuota Pemakaian" required>
            <UInput v-model.number="state.quotaTotal" type="number" min="1" placeholder="100" class="w-full" />
          </UFormField>

          <UFormField label="Maksimal Pemakaian per Akun" required>
            <UInput v-model.number="state.maxUsagePerCustomer" type="number" min="1" placeholder="1" class="w-full" />
          </UFormField>
        </div>

        <!-- Scope Event & Periode -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Berlaku Untuk Event" help="Pilih event tertentu atau berlaku umum">
            <select
              v-model="state.eventId"
              class="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-900 dark:text-gray-100 shadow-xs focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Semua Event (Global)</option>
              <option v-for="ev in eventsList" :key="ev.id" :value="ev.id">
                {{ ev.title }}
              </option>
            </select>
          </UFormField>

          <div class="flex items-center gap-3 pt-6">
            <input
              id="isActiveToggle"
              v-model="state.isActive"
              type="checkbox"
              class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 w-4 h-4 cursor-pointer"
            >
            <label for="isActiveToggle" class="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
              Voucher Aktif & Dapat Digunakan
            </label>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Mulai Berlaku">
            <UInput v-model="state.startDate" type="datetime-local" class="w-full text-xs" />
          </UFormField>

          <UFormField label="Berakhir Pada" required>
            <UInput v-model="state.endDate" type="datetime-local" class="w-full text-xs" />
          </UFormField>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          <UButton color="neutral" variant="outline" @click="emit('update:open', false)">
            Batal
          </UButton>
          <UButton type="submit" :loading="isSaving" class="bg-[#1B1330] hover:bg-[#2A1F49] text-white">
            {{ isEdit ? 'Simpan Perubahan' : 'Buat Voucher' }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
