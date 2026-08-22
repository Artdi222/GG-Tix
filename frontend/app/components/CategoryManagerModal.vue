<script setup lang="ts">
/**
 * CategoryManagerModal.vue
 * CRUD modal untuk Kategori Tiket per Event.
 *
 * API Contract (current BE):
 *   GET    /api/events/:eventId/categories   → { data: Category[] }
 *   POST   /api/events/:eventId/categories   → { data: Category }
 *   PUT    /api/categories/:id               → { data: Category }
 *   DELETE /api/categories/:id               → 204 No Content
 *
 * Field Category (sesuai BE): id, eventId, name, price (string desimal), quotaTotal, quotaSold?
 * Field tambahan FE:          benefits?: string[]  ← perlu diskusi dengan BE untuk ditambahkan
 */
export interface Category {
  id: string
  eventId: string
  name: string
  price: string        // String desimal dari BE, contoh: "750000.00"
  quotaTotal: number
  quotaSold?: number
  benefits?: string[]
}

// Props & Emits
const props = defineProps<{
  eventId: string
  eventTitle?: string
}>()

const emit = defineEmits<{
  updated: []
}>()

const open = defineModel<boolean>('open', { default: false })
const { request } = useApi()
const toast = useToast()

// State
const mode = ref<'list' | 'form'>('list')
const isLoading = ref(false)
const isSaving = ref(false)
const categories = ref<Category[]>([])
const editingCategory = ref<Category | null>(null)
const errorMsg = ref('')

const formState = reactive({
  name: '',
  price: '',
  quotaTotal: '',
  benefits: [] as string[],
})
const benefitInput = ref('')

// Watch
watch(open, (isOpen) => {
  if (isOpen) {
    mode.value = 'list'
    errorMsg.value = ''
    fetchCategories()
  }
})

// API Operations
async function fetchCategories() {
  isLoading.value = true
  try {
    const res = await request<{ data: Category[] }>(`/events/${props.eventId}/categories`)
    categories.value = res?.data ?? []
  } catch (err: any) {
    categories.value = []
    toast.add({ title: 'Gagal memuat kategori tiket', color: 'error' })
  } finally {
    isLoading.value = false
  }
}

async function onSubmitCategory() {
  errorMsg.value = ''

  const parsedPrice = parseFloat(formState.price)
  const parsedQuota = parseInt(formState.quotaTotal, 10)

  if (!formState.name.trim()) {
    errorMsg.value = 'Nama kategori wajib diisi.'
    return
  }
  if (isNaN(parsedPrice) || parsedPrice < 0) {
    errorMsg.value = 'Harga harus berupa angka yang valid (≥ 0).'
    return
  }
  if (isNaN(parsedQuota) || parsedQuota < 1) {
    errorMsg.value = 'Kuota harus berupa angka minimal 1.'
    return
  }

  isSaving.value = true

  const payload = {
    name: formState.name.trim(),
    price: parsedPrice.toFixed(2),
    quotaTotal: parsedQuota,
    benefits: formState.benefits,
  }

  try {
    if (editingCategory.value) {
      await request<{ data: Category }>(`/categories/${editingCategory.value.id}`, {
        method: 'PUT',
        body: payload,
      })
      toast.add({ title: 'Kategori tiket berhasil diperbarui', color: 'success' })
    } else {
      await request<{ data: Category }>(`/events/${props.eventId}/categories`, {
        method: 'POST',
        body: payload,
      })
      toast.add({ title: 'Kategori tiket berhasil ditambahkan', color: 'success' })
    }
    emit('updated')
    mode.value = 'list'
    await fetchCategories()
  } catch (err: any) {
    errorMsg.value = err?.data?.error || err?.data?.message || 'Gagal menyimpan kategori tiket.'
  } finally {
    isSaving.value = false
  }
}

async function onDeleteCategory(category: Category) {
  if (!confirm(`Hapus kategori "${category.name}"? Tindakan ini tidak dapat dibatalkan.`)) return
  try {
    await request(`/categories/${category.id}`, { method: 'DELETE' })
    toast.add({ title: 'Kategori berhasil dihapus', color: 'success' })
    categories.value = categories.value.filter(c => c.id !== category.id)
    emit('updated')
  } catch (err: any) {
    toast.add({ title: err?.data?.error || 'Gagal menghapus kategori', color: 'error' })
  }
}

// Form Helpers
function openCreateForm() {
  editingCategory.value = null
  formState.name = ''
  formState.price = ''
  formState.quotaTotal = ''
  formState.benefits = []
  benefitInput.value = ''
  errorMsg.value = ''
  mode.value = 'form'
}

function openEditForm(category: Category) {
  editingCategory.value = category
  formState.name = category.name
  formState.price = String(parseFloat(category.price))
  formState.quotaTotal = String(category.quotaTotal)
  formState.benefits = [...(category.benefits ?? [])]
  benefitInput.value = ''
  errorMsg.value = ''
  mode.value = 'form'
}

function backToList() {
  errorMsg.value = ''
  mode.value = 'list'
}

function addBenefit() {
  const val = benefitInput.value.trim()
  if (!val) return
  formState.benefits.push(val)
  benefitInput.value = ''
}

function removeBenefit(index: number) {
  formState.benefits.splice(index, 1)
}

// Display Helpers
function formatIDR(priceStr: string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(parseFloat(priceStr) || 0)
}

function quotaPercent(category: Category) {
  if (!category.quotaTotal) return 0
  return Math.min(Math.round(((category.quotaSold ?? 0) / category.quotaTotal) * 100), 100)
}

function quotaRemaining(category: Category) {
  return category.quotaTotal - (category.quotaSold ?? 0)
}

function quotaBarColor(percent: number) {
  if (percent >= 90) return 'bg-red-400'
  if (percent >= 60) return 'bg-amber-400'
  return 'bg-emerald-400'
}
</script>

<template>
  <UModal
    v-model:open="open"
    class="no-scrollbar"
    :title="mode === 'list'
      ? 'Kelola Kategori Tiket'
      : (editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru')"
    :description="eventTitle ? `Event: ${eventTitle}` : undefined"
  >
    <template #body>

      <!-- Mode List -->
      <div v-if="mode === 'list'" class="space-y-3 no-scrollbar">


        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
          <UIcon name="i-lucide-loader" class="animate-spin w-4 h-4" />
          Memuat kategori tiket...
        </div>

        <!-- Empty State -->
        <div
          v-else-if="!categories.length"
          class="flex flex-col items-center justify-center py-10 text-center"
        >
          <UIcon name="i-lucide-ticket-x" class="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <p class="text-sm font-medium text-gray-500">Belum ada kategori tiket</p>
          <p class="text-xs text-gray-400 mt-1">Tambahkan kategori tiket pertama untuk event ini.</p>
        </div>

        <!-- Category Cards -->
        <div v-else class="space-y-3 overflow-hidden">
          <div
            v-for="category in categories"
            :key="category.id"
            class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden "
          >
            <!-- Card Header -->
            <div class="flex items-start justify-between gap-3 px-4 pt-4">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold text-gray-900 dark:text-white">
                  {{ category.name }}
                </p>
                <p class="text-base font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                  {{ formatIDR(category.price) }}
                </p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  aria-label="Edit kategori"
                  @click="openEditForm(category)"
                />
                <UButton
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  size="xs"
                  aria-label="Hapus kategori"
                  @click="onDeleteCategory(category)"
                />
              </div>
            </div>

            <!-- Benefits List -->
            <ul
              v-if="category.benefits && category.benefits.length"
              class="px-4 pt-3 pb-1 space-y-1"
            >
              <li
                v-for="(benefit, i) in category.benefits"
                :key="i"
                class="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300"
              >
                <UIcon name="i-lucide-circle" class="w-2 h-2 mt-1.5 text-amber-500 dark:text-amber-400 shrink-0" />
                <span>{{ benefit }}</span>
              </li>
            </ul>
            <p
              v-else
              class="px-4 pt-2 pb-1 text-xs text-gray-400 dark:text-gray-500 italic"
            >
              Belum ada benefit yang ditambahkan.
            </p>

            <!-- Quota Bar -->
            <div class="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800 mt-2 space-y-1.5">
              <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  Terjual:
                  <strong class="text-gray-800 dark:text-gray-200">{{ category.quotaSold ?? 0 }}</strong>
                  dari
                  <strong class="text-gray-800 dark:text-gray-200">{{ category.quotaTotal }}</strong>
                </span>
                <span class="font-medium">
                  Sisa: {{ quotaRemaining(category) }} ({{ quotaPercent(category) }}%)
                </span>
              </div>
              <div class="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="quotaBarColor(quotaPercent(category))"
                  :style="{ width: `${quotaPercent(category)}%` }"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Tombol Tambah -->
        <UButton
          block
          color="neutral"
          variant="outline"
          icon="i-lucide-plus"
          class="border-dashed mt-1"
          @click="openCreateForm"
        >
          Tambah Kategori
        </UButton>
      </div>

      <!-- Mode Form -->
      <div v-else class="space-y-4 no-scrollbar">

        <!-- Error Alert -->
        <UAlert
          v-if="errorMsg"
          color="error"
          variant="soft"
          :description="errorMsg"
          icon="i-lucide-circle-alert"
        />

        <!-- Nama Kategori -->
        <UFormField label="Nama Kategori" required>
          <UInput
            v-model="formState.name"
            placeholder="Contoh: VVIP, VIP, Kategori 1, Reguler"
            class="w-full"
          />
        </UFormField>

        <!-- Harga & Kuota -->
        <div class="grid grid-cols-2 gap-4">
          <UFormField label="Harga (Rp)" required>
            <UInput
              v-model="formState.price"
              type="number"
              min="0"
              step="1000"
              placeholder="750000"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Kuota Tiket" required>
            <UInput
              v-model="formState.quotaTotal"
              type="number"
              min="1"
              placeholder="500"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Benefits -->
        <UFormField label="Benefit yang Didapat">
          <!-- Daftar benefit yang sudah ditambahkan -->
          <ul v-if="formState.benefits.length" class="mb-2 space-y-1.5">
            <li
              v-for="(benefit, index) in formState.benefits"
              :key="index"
              class="flex items-center justify-between gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2"
            >
              <span class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <UIcon name="i-lucide-check-circle-2" class="w-4 h-4 text-emerald-500 shrink-0" />
                {{ benefit }}
              </span>
              <button
                type="button"
                aria-label="Hapus benefit"
                class="text-gray-300 hover:text-red-400 transition-colors"
                @click="removeBenefit(index)"
              >
                <UIcon name="i-lucide-x" class="w-3.5 h-3.5" />
              </button>
            </li>
          </ul>

          <!-- Input tambah benefit -->
          <div class="flex gap-2">
            <UInput
              v-model="benefitInput"
              placeholder="Contoh: Soundcheck session, Signed poster..."
              class="flex-1"
              @keydown.enter.prevent="addBenefit"
            />
            <UButton
              icon="i-lucide-plus"
              aria-label="Tambah benefit"
              class="bg-[#1B1330] hover:bg-[#2A1F49] text-white shrink-0"
              @click="addBenefit"
            />
          </div>
          <p class="text-xs text-gray-400 mt-1.5">
            Tekan <kbd class="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">Enter</kbd> atau klik tombol + untuk menambah benefit.
          </p>
        </UFormField>

        <!-- Catatan format harga -->
        <p class="text-xs text-gray-400 dark:text-gray-500">
          <UIcon name="i-lucide-info" class="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
          Harga dikirim ke backend sebagai string desimal
          (contoh: <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">750000.00</code>).
        </p>
      </div>

    </template>

    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <template v-if="mode === 'list'">
          <UButton color="neutral" variant="outline" @click="open = false">
            Tutup
          </UButton>
        </template>
        <template v-else>
          <UButton color="neutral" variant="outline" @click="backToList">
            <UIcon name="i-lucide-arrow-left" class="w-4 h-4 mr-1" />
            Kembali
          </UButton>
          <UButton
            :loading="isSaving"
            class="bg-[#1B1330] hover:bg-[#2A1F49] text-white"
            @click="onSubmitCategory"
          >
            {{ editingCategory ? 'Simpan Perubahan' : 'Tambah Kategori' }}
          </UButton>
        </template>
      </div>
    </template>
  </UModal>
</template>

<style>
/* Sembunyikan scrollbar untuk modal kategori tiket */
.no-scrollbar,
.no-scrollbar * {
  scrollbar-width: none !important; /* Firefox */
  -ms-overflow-style: none !important; /* IE dan Edge */
}
.no-scrollbar::-webkit-scrollbar,
.no-scrollbar *::-webkit-scrollbar {
  display: none !important; /* Chrome, Safari, dan Opera */
}
</style>
