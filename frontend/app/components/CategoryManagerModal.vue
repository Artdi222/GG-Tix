<script setup lang="ts">
interface Category {
  id: string
  eventId: string
  name: string
  price: string
  quotaTotal: number
  quotaRemaining: number
  benefits: string[]
  sortOrder: number
}

const props = defineProps<{ eventId: string, eventTitle?: string }>()
const open = defineModel<boolean>('open', { default: false })

const { request } = useApi()
const toast = useToast()
const confirm = useConfirm()

const categories = ref<Category[]>([])
const loading = ref(false)
const loadError = ref('')
const editing = ref<Category | null>(null)
const showForm = ref(false)
const saving = ref(false)
const formError = ref('')
const form = reactive({ name: '', price: undefined as number | undefined, quotaTotal: undefined as number | undefined, benefits: [] as string[] })

const sold = (c: Category) => c.quotaTotal - c.quotaRemaining
const soldPct = (c: Category) => c.quotaTotal ? Math.round((sold(c) / c.quotaTotal) * 100) : 0

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const res = await request<{ data: Category[] }>(`/events/${props.eventId}/categories`)
    categories.value = [...res.data].sort((a, b) => a.sortOrder - b.sortOrder || Number(a.price) - Number(b.price))
  } catch (err) {
    loadError.value = apiErrorMessage(err, 'Kategori gagal dimuat.')
  } finally {
    loading.value = false
  }
}

watch([open, () => props.eventId], ([isOpen]) => {
  if (!isOpen) return
  showForm.value = false
  load()
}, { immediate: true })

function startForm(category: Category | null) {
  editing.value = category
  formError.value = ''
  Object.assign(form, category
    ? { name: category.name, price: Number(category.price), quotaTotal: category.quotaTotal, benefits: [...category.benefits] }
    : { name: '', price: undefined, quotaTotal: undefined, benefits: [] })
  showForm.value = true
}

async function save() {
  formError.value = ''
  if (!form.name.trim()) formError.value = 'Nama kategori wajib diisi.'
  else if (form.price === undefined || form.price < 0) formError.value = 'Harga harus 0 atau lebih.'
  else if (!form.quotaTotal || form.quotaTotal < 1) formError.value = 'Kuota minimal 1.'
  else if (editing.value && form.quotaTotal < sold(editing.value)) formError.value = `Kuota tidak boleh kurang dari ${sold(editing.value)} tiket yang sudah terjual.`
  if (formError.value) return

  saving.value = true
  const body = { name: form.name.trim(), price: form.price!.toFixed(2), quotaTotal: form.quotaTotal, benefits: form.benefits }
  try {
    if (editing.value) await request(`/categories/${editing.value.id}`, { method: 'PUT', body })
    else await request(`/events/${props.eventId}/categories`, { method: 'POST', body })
    toast.add({ title: editing.value ? 'Kategori diperbarui' : 'Kategori ditambahkan', color: 'success' })
    showForm.value = false
    await load()
  } catch (err) {
    formError.value = apiErrorMessage(err, 'Kategori gagal disimpan.')
  } finally {
    saving.value = false
  }
}

async function remove(category: Category) {
  const ok = await confirm({
    title: `Hapus kategori "${category.name}"?`,
    description: sold(category) ? `${sold(category)} tiket kategori ini sudah terjual, sehingga kategori tidak dapat dihapus.` : 'Kategori akan dihapus permanen.',
    confirmLabel: 'Hapus',
    danger: true
  })
  if (!ok) return
  try {
    await request(`/categories/${category.id}`, { method: 'DELETE' })
    toast.add({ title: 'Kategori dihapus', color: 'success' })
    await load()
  } catch (err) {
    toast.add({ title: 'Kategori tidak dapat dihapus', description: apiErrorMessage(err), color: 'error' })
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Kategori tiket"
    :description="eventTitle"
    :ui="{ content: 'sm:max-w-2xl' }"
  >
    <template #body>
      <form
        v-if="showForm"
        id="category-form"
        class="space-y-4"
        @submit.prevent="save"
      >
        <div class="grid sm:grid-cols-3 gap-4">
          <UFormField
            label="Nama"
            required
          >
            <UInput
              v-model="form.name"
              placeholder="VIP"
              maxlength="50"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Harga (Rp)"
            required
          >
            <UInputNumber
              v-model="form.price"
              :min="0"
              :step="10000"
              :format-options="{ maximumFractionDigits: 0 }"
              class="w-full"
            />
          </UFormField>
          <UFormField
            label="Kuota"
            required
            :hint="editing ? `${sold(editing)} terjual` : undefined"
          >
            <UInputNumber
              v-model="form.quotaTotal"
              :min="editing ? Math.max(1, sold(editing)) : 1"
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField
          label="Benefit"
          hint="Tekan Enter untuk menambah"
        >
          <UInputTags
            v-model="form.benefits"
            placeholder="Merchandise eksklusif…"
            class="w-full"
          />
        </UFormField>
        <UAlert
          v-if="formError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :title="formError"
        />
        <div class="flex justify-end gap-2">
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="saving"
            @click="showForm = false"
          />
          <UButton
            type="submit"
            :label="editing ? 'Simpan' : 'Tambah kategori'"
            :loading="saving"
          />
        </div>
      </form>

      <template v-else>
        <div class="flex items-center justify-between mb-3">
          <p class="text-sm text-muted">
            {{ categories.length }} kategori
          </p>
          <UButton
            icon="i-lucide-plus"
            label="Tambah kategori"
            @click="startForm(null)"
          />
        </div>

        <UAlert
          v-if="loadError"
          color="error"
          variant="subtle"
          :title="loadError"
          :actions="[{ label: 'Coba lagi', color: 'error', variant: 'outline', onClick: load }]"
        />
        <div
          v-else-if="loading && !categories.length"
          class="space-y-2"
        >
          <USkeleton
            v-for="i in 3"
            :key="i"
            class="h-16 w-full"
          />
        </div>
        <UEmpty
          v-else-if="!categories.length"
          icon="i-lucide-tags"
          title="Belum ada kategori"
          description="Tiket baru bisa dijual setelah minimal satu kategori dibuat."
          variant="naked"
        />
        <ul
          v-else
          class="divide-y divide-default rounded-lg border border-default"
        >
          <li
            v-for="c in categories"
            :key="c.id"
            class="flex items-center gap-4 px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-baseline gap-2">
                <p class="font-medium text-highlighted truncate">
                  {{ c.name }}
                </p>
                <p class="text-sm text-muted tabular-nums">
                  {{ formatIDR(c.price) }}
                </p>
              </div>
              <div class="mt-1.5 flex items-center gap-3">
                <UProgress
                  :model-value="soldPct(c)"
                  size="xs"
                  :color="soldPct(c) >= 90 ? 'error' : soldPct(c) >= 60 ? 'warning' : 'primary'"
                  class="max-w-48"
                />
                <span class="text-xs text-muted tabular-nums whitespace-nowrap">{{ formatNumber(sold(c)) }} / {{ formatNumber(c.quotaTotal) }} terjual</span>
              </div>
              <p
                v-if="c.benefits.length"
                class="mt-1 text-xs text-dimmed truncate"
              >
                {{ c.benefits.join(' · ') }}
              </p>
            </div>
            <UButton
              icon="i-lucide-pencil"
              color="neutral"
              variant="ghost"
              :aria-label="`Edit ${c.name}`"
              @click="startForm(c)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              :aria-label="`Hapus ${c.name}`"
              @click="remove(c)"
            />
          </li>
        </ul>
      </template>
    </template>
  </UModal>
</template>
