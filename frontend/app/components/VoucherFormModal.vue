<script setup lang="ts">
export interface Voucher {
  id: string
  code: string
  name: string
  description: string | null
  discountType: 'fixed' | 'percentage'
  discountValue: string
  maxDiscountAmount: string | null
  minOrderAmount: string
  quotaTotal: number
  quotaRemaining: number
  maxUsagePerCustomer: number
  eventId: string | null
  eventTitle: string | null
  startDate: string | null
  endDate: string
  isActive: boolean
}

const props = withDefaults(defineProps<{ voucher?: Voucher | null }>(), { voucher: null })
const emit = defineEmits<{ saved: [] }>()
const open = defineModel<boolean>('open', { default: false })

const { request } = useApi()
const toast = useToast()

const events = ref<{ label: string, value: string }[]>([])
const saving = ref(false)
const formError = ref('')
const isEdit = computed(() => !!props.voucher)
const used = computed(() => props.voucher ? props.voucher.quotaTotal - props.voucher.quotaRemaining : 0)

function blank() {
  return {
    code: '',
    name: '',
    description: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10 as number | undefined,
    maxDiscountAmount: undefined as number | undefined,
    minOrderAmount: 0 as number | undefined,
    quotaTotal: 100 as number | undefined,
    maxUsagePerCustomer: 1 as number | undefined,
    eventId: 'all',
    startDate: '',
    endDate: toDatetimeLocal(new Date(Date.now() + 30 * 86400000)),
    isActive: true
  }
}
const state = reactive(blank())

watch(open, async (isOpen) => {
  if (!isOpen) return
  formError.value = ''
  const v = props.voucher
  Object.assign(state, v
    ? {
        code: v.code,
        name: v.name,
        description: v.description ?? '',
        discountType: v.discountType,
        discountValue: Number(v.discountValue),
        maxDiscountAmount: v.maxDiscountAmount ? Number(v.maxDiscountAmount) : undefined,
        minOrderAmount: Number(v.minOrderAmount),
        quotaTotal: v.quotaTotal,
        maxUsagePerCustomer: v.maxUsagePerCustomer,
        eventId: v.eventId ?? 'all',
        startDate: toDatetimeLocal(v.startDate),
        endDate: toDatetimeLocal(v.endDate),
        isActive: v.isActive
      }
    : blank())
  if (!events.value.length) {
    try {
      const res = await request<{ data: { id: string, title: string }[] }>('/events', { query: { limit: 100 } })
      events.value = res.data.map(e => ({ label: e.title, value: e.id }))
    } catch {
      // Event scoping stays "all events" if the list cannot load.
    }
  }
})

const money = (n: number | undefined) => (n ?? 0).toFixed(2)

function validate() {
  if (!isEdit.value && !/^[A-Za-z0-9_-]{3,50}$/.test(state.code)) return 'Kode 3–50 karakter: huruf, angka, - atau _.'
  if (state.name.trim().length < 2) return 'Nama promo minimal 2 karakter.'
  if (!state.discountValue || state.discountValue <= 0) return 'Nilai diskon harus lebih dari 0.'
  if (state.discountType === 'percentage' && state.discountValue > 100) return 'Diskon persentase maksimal 100%.'
  if (!state.quotaTotal || state.quotaTotal < 1) return 'Kuota minimal 1.'
  if (state.quotaTotal < used.value) return `Kuota tidak boleh kurang dari ${used.value} yang sudah terpakai.`
  if (!state.endDate) return 'Isi tanggal berakhir.'
  if (state.startDate && state.endDate <= state.startDate) return 'Tanggal berakhir harus setelah tanggal mulai.'
  return ''
}

async function submit() {
  formError.value = validate()
  if (formError.value) return
  saving.value = true
  const body = {
    ...(isEdit.value ? {} : { code: state.code.trim().toUpperCase() }),
    name: state.name.trim(),
    description: state.description.trim() || undefined,
    discountType: state.discountType,
    discountValue: money(state.discountValue),
    maxDiscountAmount: state.discountType === 'percentage' && state.maxDiscountAmount ? money(state.maxDiscountAmount) : null,
    minOrderAmount: money(state.minOrderAmount),
    quotaTotal: state.quotaTotal,
    maxUsagePerCustomer: state.maxUsagePerCustomer || 1,
    eventId: state.eventId === 'all' ? null : state.eventId,
    startDate: fromDatetimeLocal(state.startDate) ?? undefined,
    endDate: fromDatetimeLocal(state.endDate),
    isActive: state.isActive
  }
  try {
    if (props.voucher) await request(`/vouchers/${props.voucher.id}`, { method: 'PUT', body })
    else await request('/vouchers', { method: 'POST', body })
    toast.add({ title: isEdit.value ? 'Voucher diperbarui' : 'Voucher dibuat', color: 'success' })
    open.value = false
    emit('saved')
  } catch (err) {
    formError.value = apiErrorMessage(err, 'Voucher gagal disimpan.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isEdit ? `Edit voucher ${voucher?.code}` : 'Buat voucher'"
    :dismissible="!saving"
    :ui="{ content: 'sm:max-w-2xl', footer: 'justify-end' }"
  >
    <template #body>
      <form
        id="voucher-form"
        class="space-y-4"
        @submit.prevent="submit"
      >
        <div class="grid sm:grid-cols-2 gap-4">
          <UFormField
            label="Kode"
            required
            :help="isEdit ? 'Tidak dapat diubah' : undefined"
          >
            <UInput
              v-model="state.code"
              :disabled="isEdit"
              placeholder="KONSER10"
              class="w-full font-mono uppercase"
              maxlength="50"
            />
          </UFormField>
          <UFormField
            label="Nama promo"
            required
          >
            <UInput
              v-model="state.name"
              placeholder="Diskon pembukaan"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Deskripsi">
          <UTextarea
            v-model="state.description"
            :rows="2"
            autoresize
            class="w-full"
          />
        </UFormField>

        <div class="grid sm:grid-cols-3 gap-4">
          <UFormField label="Tipe diskon">
            <USelect
              v-model="state.discountType"
              :items="[{ label: 'Persentase (%)', value: 'percentage' }, { label: 'Nominal (Rp)', value: 'fixed' }]"
              class="w-full"
            />
          </UFormField>
          <UFormField
            :label="state.discountType === 'percentage' ? 'Diskon (%)' : 'Diskon (Rp)'"
            required
          >
            <UInputNumber
              v-model="state.discountValue"
              :min="0"
              :max="state.discountType === 'percentage' ? 100 : undefined"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="state.discountType === 'percentage'"
            label="Maks. potongan (Rp)"
          >
            <UInputNumber
              v-model="state.maxDiscountAmount"
              :min="0"
              :step="10000"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Min. belanja (Rp)">
            <UInputNumber
              v-model="state.minOrderAmount"
              :min="0"
              :step="10000"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Kuota total"
            required
            :help="isEdit ? `${used} terpakai` : undefined"
          >
            <UInputNumber
              v-model="state.quotaTotal"
              :min="Math.max(1, used)"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Maks. per pelanggan">
            <UInputNumber
              v-model="state.maxUsagePerCustomer"
              :min="1"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField label="Berlaku untuk">
          <USelectMenu
            v-model="state.eventId"
            :items="[{ label: 'Semua event', value: 'all' }, ...events]"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <div class="grid sm:grid-cols-2 gap-4">
          <UFormField
            label="Mulai"
            help="Kosong = langsung berlaku"
          >
            <UInput
              v-model="state.startDate"
              type="datetime-local"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Berakhir"
            required
          >
            <UInput
              v-model="state.endDate"
              type="datetime-local"
              :min="state.startDate || undefined"
              class="w-full"
            />
          </UFormField>
        </div>

        <USwitch
          v-model="state.isActive"
          label="Aktif"
          description="Voucher nonaktif tidak bisa dipakai pelanggan."
        />

        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="formError"
          role="alert"
        />
      </form>
    </template>
    <template #footer>
      <UButton
        label="Batal"
        color="neutral"
        variant="outline"
        :disabled="saving"
        @click="open = false"
      />
      <UButton
        type="submit"
        form="voucher-form"
        :label="isEdit ? 'Simpan perubahan' : 'Buat voucher'"
        :loading="saving"
      />
    </template>
  </UModal>
</template>
