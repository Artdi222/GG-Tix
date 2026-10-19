<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { AdminRole } from '~/composables/useAuth'

definePageMeta({ roles: ['super_admin', 'admin'] })
useHead({ title: 'Pengguna' })

interface Customer { id: string, name: string, email: string, createdAt: string }
interface Admin { id: string, name: string, email: string, role: AdminRole, createdAt: string }

const route = useRoute()
const router = useRouter()
const { request } = useApi()
const { user, isSuperAdmin } = useAuth()
const toast = useToast()
const confirm = useConfirm()

const tab = computed({
  get: () => (route.query.tab === 'admins' && isSuperAdmin.value ? 'admins' : 'customers'),
  set: value => router.replace({ query: value === 'admins' ? { tab: 'admins' } : {} })
})

const customers = usePaginatedList<Customer>('/users/customers', { searchParam: 'search' })
const roleFilter = ref<AdminRole | 'all'>('all')
// Only super admins may list admins; don't fire a request that is guaranteed to 403.
const admins = usePaginatedList<Admin>('/users/admins', {
  searchParam: 'search',
  immediate: false,
  query: () => ({ role: roleFilter.value === 'all' ? undefined : roleFilter.value })
})
onMounted(() => {
  if (isSuperAdmin.value) admins.refresh()
})

const roleOptions = [
  { label: 'Super Admin', value: 'super_admin', description: 'Akses penuh, termasuk pengaturan & pengguna' },
  { label: 'Admin', value: 'admin', description: 'Kelola event, pesanan, voucher' },
  { label: 'Gate Staff', value: 'gate_staff', description: 'Hanya scan check-in' }
]

const formOpen = ref(false)
const editing = ref<Admin | null>(null)
const saving = ref(false)
const formError = ref('')
const form = reactive({ name: '', email: '', password: '', role: 'admin' as AdminRole })
const isSelf = computed(() => editing.value?.id === user.value?.id)

function openForm(a: Admin | null) {
  editing.value = a
  formError.value = ''
  Object.assign(form, a ? { name: a.name, email: a.email, password: '', role: a.role } : { name: '', email: '', password: '', role: 'admin' })
  formOpen.value = true
}

async function save() {
  formError.value = ''
  if (!form.name.trim()) formError.value = 'Nama wajib diisi.'
  else if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) formError.value = 'Format email tidak valid.'
  else if (!editing.value && !form.password) formError.value = 'Password wajib diisi untuk akun baru.'
  else if (form.password && form.password.length < 8) formError.value = 'Password minimal 8 karakter.'
  if (formError.value) return
  saving.value = true
  const body = {
    name: form.name.trim(),
    email: form.email.trim(),
    ...(isSelf.value ? {} : { role: form.role }),
    ...(form.password ? { password: form.password } : {})
  }
  try {
    if (editing.value) await request(`/users/admins/${editing.value.id}`, { method: 'PUT', body })
    else await request('/users/admins', { method: 'POST', body })
    toast.add({ title: editing.value ? 'Akun diperbarui' : 'Akun admin dibuat', color: 'success' })
    formOpen.value = false
    await admins.refresh()
  } catch (err) {
    formError.value = apiErrorMessage(err, 'Akun gagal disimpan.')
  } finally {
    saving.value = false
  }
}

async function remove(a: Admin) {
  const ok = await confirm({ title: `Hapus akun ${a.name}?`, description: `${a.email} tidak akan bisa masuk lagi.`, confirmLabel: 'Hapus akun', danger: true })
  if (!ok) return
  try {
    await request(`/users/admins/${a.id}`, { method: 'DELETE' })
    toast.add({ title: 'Akun dihapus', color: 'success' })
    await admins.refresh()
  } catch (err) {
    toast.add({ title: 'Akun tidak dapat dihapus', description: apiErrorMessage(err), color: 'error' })
  }
}

const customerColumns: TableColumn<Customer>[] = [
  { accessorKey: 'name', header: 'Pelanggan' },
  { accessorKey: 'createdAt', header: 'Terdaftar' }
]
const adminColumns: TableColumn<Admin>[] = [
  { accessorKey: 'name', header: 'Akun' },
  { accessorKey: 'role', header: 'Role' },
  { accessorKey: 'createdAt', header: 'Dibuat' },
  { id: 'actions', header: '' }
]
const roleColor = (r: AdminRole) => (r === 'super_admin' ? 'primary' : r === 'admin' ? 'info' : 'neutral')
</script>

<template>
  <UDashboardPanel id="users">
    <template #header>
      <UDashboardNavbar title="Pengguna">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            v-if="tab === 'admins'"
            icon="i-lucide-user-plus"
            label="Tambah admin"
            @click="openForm(null)"
          />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <template #left>
          <UTabs
            v-if="isSuperAdmin"
            v-model="tab"
            :items="[{ label: 'Pelanggan', value: 'customers' }, { label: 'Admin & staf', value: 'admins' }]"
            :content="false"
            variant="link"
            size="sm"
          />
        </template>
        <template #right>
          <USelect
            v-if="tab === 'admins'"
            v-model="roleFilter"
            :items="[{ label: 'Semua role', value: 'all' }, ...roleOptions]"
            class="w-36"
            aria-label="Filter role"
          />
          <UInput
            v-if="tab === 'customers'"
            v-model="customers.search.value"
            icon="i-lucide-search"
            placeholder="Cari nama atau email…"
            class="w-64"
            aria-label="Cari pelanggan"
          />
          <UInput
            v-else
            v-model="admins.search.value"
            icon="i-lucide-search"
            placeholder="Cari nama atau email…"
            class="w-64"
            aria-label="Cari admin"
          />
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <template v-if="tab === 'customers'">
        <UAlert
          v-if="customers.error.value"
          color="error"
          variant="subtle"
          :title="customers.error.value"
        />
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <UTable
            :data="customers.items.value"
            :columns="customerColumns"
            :loading="customers.loading.value"
            :ui="{ th: 'text-xs font-medium text-muted', td: 'py-3' }"
          >
            <template #name-cell="{ row }">
              <div class="flex items-center gap-3">
                <UAvatar
                  :alt="row.original.name"
                  size="sm"
                />
                <div>
                  <p class="font-medium text-highlighted">
                    {{ row.original.name }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ row.original.email }}
                  </p>
                </div>
              </div>
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-muted">{{ formatDate(row.original.createdAt) }}</span>
            </template>
            <template #empty>
              <div
                v-if="customers.loading.value"
                class="space-y-3 p-4"
              >
                <USkeleton
                  v-for="i in 5"
                  :key="i"
                  class="h-9 w-full"
                />
              </div>
              <UEmpty
                v-else
                icon="i-lucide-users"
                :title="customers.search.value ? 'Tidak ada pelanggan yang cocok' : 'Belum ada pelanggan'"
                variant="naked"
              />
            </template>
          </UTable>
        </UCard>
        <div
          v-if="customers.totalPages.value > 1"
          class="flex items-center justify-between"
        >
          <p class="text-sm text-muted tabular-nums">
            {{ formatNumber(customers.totalCount.value) }} pelanggan
          </p>
          <UPagination
            v-model:page="customers.page.value"
            :total="customers.totalCount.value"
            :items-per-page="customers.limit"
          />
        </div>
      </template>

      <template v-else>
        <UAlert
          v-if="admins.error.value"
          color="error"
          variant="subtle"
          :title="admins.error.value"
        />
        <UCard :ui="{ body: 'p-0 sm:p-0' }">
          <UTable
            :data="admins.items.value"
            :columns="adminColumns"
            :loading="admins.loading.value"
            :ui="{ th: 'text-xs font-medium text-muted', td: 'py-3' }"
          >
            <template #name-cell="{ row }">
              <div class="flex items-center gap-3">
                <UAvatar
                  :alt="row.original.name"
                  size="sm"
                />
                <div>
                  <p class="font-medium text-highlighted">
                    {{ row.original.name }}
                    <span
                      v-if="row.original.id === user?.id"
                      class="ml-1 text-xs font-normal text-muted"
                    >(Anda)</span>
                  </p>
                  <p class="text-xs text-muted">
                    {{ row.original.email }}
                  </p>
                </div>
              </div>
            </template>
            <template #role-cell="{ row }">
              <UBadge
                :label="ROLE_LABELS[row.original.role]"
                :color="roleColor(row.original.role)"
                variant="subtle"
              />
            </template>
            <template #createdAt-cell="{ row }">
              <span class="text-muted">{{ formatDate(row.original.createdAt) }}</span>
            </template>
            <template #actions-cell="{ row }">
              <div class="flex justify-end gap-1">
                <UButton
                  icon="i-lucide-pencil"
                  color="neutral"
                  variant="ghost"
                  :aria-label="`Edit ${row.original.name}`"
                  @click="openForm(row.original)"
                />
                <UButton
                  v-if="row.original.id !== user?.id"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="ghost"
                  :aria-label="`Hapus ${row.original.name}`"
                  @click="remove(row.original)"
                />
              </div>
            </template>
            <template #empty>
              <div
                v-if="admins.loading.value"
                class="space-y-3 p-4"
              >
                <USkeleton
                  v-for="i in 5"
                  :key="i"
                  class="h-9 w-full"
                />
              </div>
              <UEmpty
                v-else
                icon="i-lucide-shield-user"
                title="Tidak ada akun yang cocok"
                variant="naked"
              />
            </template>
          </UTable>
        </UCard>
        <div
          v-if="admins.totalPages.value > 1"
          class="flex justify-end"
        >
          <UPagination
            v-model:page="admins.page.value"
            :total="admins.totalCount.value"
            :items-per-page="admins.limit"
          />
        </div>
      </template>

      <UModal
        v-model:open="formOpen"
        :title="editing ? 'Edit akun' : 'Tambah admin'"
        :dismissible="!saving"
        :ui="{ footer: 'justify-end' }"
      >
        <template #body>
          <form
            id="admin-form"
            class="space-y-4"
            @submit.prevent="save"
          >
            <UFormField
              label="Nama"
              required
            >
              <UInput
                v-model="form.name"
                maxlength="100"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Email"
              required
            >
              <UInput
                v-model="form.email"
                type="email"
                maxlength="150"
                class="w-full"
              />
            </UFormField>
            <UFormField
              :label="editing ? 'Password baru' : 'Password'"
              :required="!editing"
              :help="editing ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'"
            >
              <UInput
                v-model="form.password"
                type="password"
                autocomplete="new-password"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Role"
              :help="isSelf ? 'Role akun sendiri tidak dapat diubah' : undefined"
            >
              <USelect
                v-model="form.role"
                :items="roleOptions"
                :disabled="isSelf"
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
          </form>
        </template>
        <template #footer>
          <UButton
            label="Batal"
            color="neutral"
            variant="outline"
            :disabled="saving"
            @click="formOpen = false"
          />
          <UButton
            type="submit"
            form="admin-form"
            :label="editing ? 'Simpan' : 'Buat akun'"
            :loading="saving"
          />
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
