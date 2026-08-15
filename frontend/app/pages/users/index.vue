<script setup lang="ts">
interface CustomerUser {
  id: string
  name: string
  email: string
  createdAt: string
}

interface AdminUser {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'staff' | string
  createdAt: string
}

const { request } = useApi()
const { user } = useAuth()

// State
const activeTab = ref<'customers' | 'admins'>('customers')
const customerSearch = ref('')
const adminSearch = ref('')
const customersLoading = ref(false)
const adminsLoading = ref(false)

// Fallback Mock Data
const DUMMY_CUSTOMERS: CustomerUser[] = [
  { id: 'cust-1', name: 'Sari Dewi', email: 'sari@example.com', createdAt: '2026-08-01T10:00:00Z' },
  { id: 'cust-2', name: 'Andi Pratama', email: 'andi@example.com', createdAt: '2026-08-02T14:30:00Z' },
  { id: 'cust-3', name: 'Rina Kartika', email: 'rina@example.com', createdAt: '2026-08-03T09:15:00Z' },
  { id: 'cust-4', name: 'Budi Kurniawan', email: 'budi.k@example.com', createdAt: '2026-08-05T11:20:00Z' },
  { id: 'cust-5', name: 'Maya Indah', email: 'maya@example.com', createdAt: '2026-08-07T16:45:00Z' }
]

const DUMMY_ADMINS: AdminUser[] = [
  { id: 'adm-1', name: 'Budi Santoso', email: 'budi@ggtix.com', role: 'super_admin', createdAt: '2026-07-15T08:00:00Z' },
  { id: 'adm-2', name: 'Artdi', email: 'artdi@ggtix.com', role: 'super_admin', createdAt: '2026-07-15T08:00:00Z' },
  { id: 'adm-3', name: 'Siti Rahayu', email: 'siti@ggtix.com', role: 'staff', createdAt: '2026-07-20T09:30:00Z' }
]

const customers = ref<CustomerUser[]>([])
const admins = ref<AdminUser[]>([])

// Admin Modal State
const isModalOpen = ref(false)
const editingAdmin = ref<AdminUser | null>(null)
const isSaving = ref(false)
const errorMsg = ref('')

const adminForm = reactive({
  name: '',
  email: '',
  password: '',
  role: 'staff' as 'staff' | 'super_admin'
})

const roleOptions = [
  { label: 'Staff Admin', value: 'staff' },
  { label: 'Super Admin', value: 'super_admin' }
]

// Data Fetching
async function loadCustomers() {
  customersLoading.value = true
  try {
    const res = await request<{ data: CustomerUser[] }>('/users/customers', {
      query: { search: customerSearch.value, limit: 50 }
    })
    customers.value = res?.data ?? DUMMY_CUSTOMERS
  } catch {
    // Fallback local mock data when offline
    customers.value = DUMMY_CUSTOMERS
  } finally {
    customersLoading.value = false
  }
}

async function loadAdmins() {
  adminsLoading.value = true
  try {
    const res = await request<{ data: AdminUser[] }>('/users/admins', {
      query: { search: adminSearch.value, limit: 50 }
    })
    admins.value = res?.data ?? DUMMY_ADMINS
  } catch {
    // Fallback local mock data when offline
    admins.value = DUMMY_ADMINS
  } finally {
    adminsLoading.value = false
  }
}

let debounceTimer: any = null
function debouncedLoadCustomers() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadCustomers, 300)
}
function debouncedLoadAdmins() {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadAdmins, 300)
}

// Filtered Computed Lists
const filteredCustomers = computed(() => {
  if (!customerSearch.value) return customers.value
  const q = customerSearch.value.toLowerCase()
  return customers.value.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
})

const filteredAdmins = computed(() => {
  if (!adminSearch.value) return admins.value
  const q = adminSearch.value.toLowerCase()
  return admins.value.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
})

// Modal Handlers
function openAdminModal(admin?: AdminUser) {
  editingAdmin.value = admin || null
  errorMsg.value = ''
  if (admin) {
    adminForm.name = admin.name
    adminForm.email = admin.email
    adminForm.password = ''
    adminForm.role = (admin.role === 'super_admin' ? 'super_admin' : 'staff')
  } else {
    adminForm.name = ''
    adminForm.email = ''
    adminForm.password = ''
    adminForm.role = 'staff'
  }
  isModalOpen.value = true
}

async function saveAdmin() {
  if (!adminForm.name.trim() || !adminForm.email.trim()) {
    errorMsg.value = 'Nama dan email wajib diisi.'
    return
  }
  if (!editingAdmin.value && !adminForm.password) {
    errorMsg.value = 'Password wajib diisi untuk admin baru.'
    return
  }

  isSaving.value = true
  errorMsg.value = ''

  try {
    const payload: any = {
      name: adminForm.name.trim(),
      email: adminForm.email.trim(),
      role: adminForm.role
    }
    if (adminForm.password) payload.password = adminForm.password

    if (editingAdmin.value) {
      await request(`/users/admins/${editingAdmin.value.id}`, { method: 'PUT', body: payload })
      const idx = admins.value.findIndex((a) => a.id === editingAdmin.value!.id)
      if (idx !== -1) {
        admins.value[idx] = { ...admins.value[idx], ...payload }
      }
    } else {
      const res = await request<{ data: AdminUser }>('/users/admins', {
        method: 'POST',
        body: { ...payload, password: adminForm.password }
      })
      admins.value.unshift(
        res?.data ?? {
          id: `adm-${Date.now()}`,
          name: adminForm.name,
          email: adminForm.email,
          role: adminForm.role,
          createdAt: new Date().toISOString()
        }
      )
    }
    isModalOpen.value = false
    loadAdmins()
  } catch (err: any) {
    errorMsg.value = err?.data?.message || 'Gagal menyimpan data admin.'
    // Local fallback update if offline
    if (editingAdmin.value) {
      const target = admins.value.find((a) => a.id === editingAdmin.value!.id)
      if (target) {
        target.name = adminForm.name
        target.email = adminForm.email
        target.role = adminForm.role
      }
    } else {
      admins.value.unshift({
        id: `adm-${Date.now()}`,
        name: adminForm.name,
        email: adminForm.email,
        role: adminForm.role,
        createdAt: new Date().toISOString()
      })
    }
    isModalOpen.value = false
  } finally {
    isSaving.value = false
  }
}

async function deleteAdmin(id: string) {
  if (!confirm('Yakin ingin menghapus admin ini?')) return
  try {
    await request(`/users/admins/${id}`, { method: 'DELETE' })
  } catch {
    // Local delete fallback
  }
  admins.value = admins.value.filter((a) => a.id !== id)
}

function formatDate(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

watch(activeTab, (newTab) => {
  if (newTab === 'customers') loadCustomers()
  else loadAdmins()
})

onMounted(() => {
  loadCustomers()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header Page -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Manajemen Data Pengguna
        </h1>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Kelola data akun pelanggan (customer) dan tim admin GGTIX (/api/users)
        </p>
      </div>

      <!-- Action Button for Super Admin -->
      <UButton
        v-if="activeTab === 'admins' && user?.role === 'super_admin'"
        color="primary"
        icon="i-lucide-user-plus"
        size="md"
        class="font-semibold shadow-sm"
        @click="openAdminModal()"
      >
        Tambah Admin
      </UButton>
    </div>

    <!-- Stats Summary KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Total Pelanggan</p>
          <h3 class="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{{ customers.length }}</h3>
          <p class="text-xs text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-trending-up" class="w-3.5 h-3.5" />
            Terdaftar di platform
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <UIcon name="i-lucide-users" class="w-6 h-6" />
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm flex items-center justify-between">
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tim Admin & Staff</p>
          <h3 class="text-2xl font-extrabold text-gray-900 dark:text-white mt-1">{{ admins.length }}</h3>
          <p class="text-xs text-amber-600 dark:text-amber-400 mt-1 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-shield-check" class="w-3.5 h-3.5" />
            Pengelola internal
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <UIcon name="i-lucide-user-cog" class="w-6 h-6" />
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm flex items-center justify-between sm:col-span-2 lg:col-span-1">
        <div>
          <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Status Hak Akses</p>
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mt-1">
            {{ user?.role === 'super_admin' ? 'Super Admin' : 'Staff Admin' }}
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {{ user?.email || 'admin@ggtix.com' }}
          </p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
          <UIcon name="i-lucide-key-round" class="w-6 h-6" />
        </div>
      </div>
    </div>

    <!-- Navigation Pills / Tabs -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm">
      <!-- Tabs Switcher -->
      <div class="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-800 w-full sm:w-auto">
        <button
          type="button"
          :class="[
            'flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
            activeTab === 'customers'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          ]"
          @click="activeTab = 'customers'"
        >
          <UIcon name="i-lucide-users" class="w-4 h-4 text-emerald-500" />
          <span>Data Pelanggan ({{ customers.length }})</span>
        </button>

        <button
          type="button"
          :class="[
            'flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all',
            activeTab === 'admins'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          ]"
          @click="activeTab = 'admins'"
        >
          <UIcon name="i-lucide-shield-check" class="w-4 h-4 text-amber-500" />
          <span>Tim Admin ({{ admins.length }})</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="w-full sm:w-72">
        <UInput
          v-if="activeTab === 'customers'"
          v-model="customerSearch"
          icon="i-lucide-search"
          placeholder="Cari nama atau email pelanggan..."
          size="md"
          class="w-full"
          @input="debouncedLoadCustomers"
        />
        <UInput
          v-else
          v-model="adminSearch"
          icon="i-lucide-search"
          placeholder="Cari nama atau email admin..."
          size="md"
          class="w-full"
          @input="debouncedLoadAdmins"
        />
      </div>
    </div>

    <!-- TAB 1: DATA PELANGGAN -->
    <div v-if="activeTab === 'customers'" class="space-y-4">
      <div class="overflow-x-auto rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-xs">
            <tr>
              <th scope="col" class="px-6 py-4">Pelanggan</th>
              <th scope="col" class="px-6 py-4">Alamat Email</th>
              <th scope="col" class="px-6 py-4">Tipe Akun</th>
              <th scope="col" class="px-6 py-4 text-right">Tanggal Terdaftar</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
            <tr v-if="customersLoading">
              <td colspan="4" class="px-6 py-10 text-center text-gray-400">
                <UIcon name="i-lucide-loader" class="animate-spin w-5 h-5 mx-auto mb-2" />
                Memuat data pelanggan...
              </td>
            </tr>
            <tr v-else-if="filteredCustomers.length === 0">
              <td colspan="4" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">
                Tidak ada data pelanggan yang ditemukan.
              </td>
            </tr>
            <tr
              v-for="customer in filteredCustomers"
              :key="customer.id"
              class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                  <UAvatar
                    :alt="customer.name"
                    size="md"
                    class="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold"
                  />
                  <div>
                    <div class="font-bold text-gray-900 dark:text-white">{{ customer.name }}</div>
                    <div class="text-xs text-gray-400">ID: {{ customer.id }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                {{ customer.email }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <UBadge color="success" variant="soft" size="xs" class="font-semibold">
                  Customer
                </UBadge>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-right text-gray-500 dark:text-gray-400">
                {{ formatDate(customer.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: TIM ADMIN -->
    <div v-if="activeTab === 'admins'" class="space-y-4">
      <div class="overflow-x-auto rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-xs">
            <tr>
              <th scope="col" class="px-6 py-4">Anggota Tim Admin</th>
              <th scope="col" class="px-6 py-4">Email</th>
              <th scope="col" class="px-6 py-4">Hak Akses (Role)</th>
              <th scope="col" class="px-6 py-4">Terdaftar</th>
              <th v-if="user?.role === 'super_admin'" scope="col" class="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
            <tr v-if="adminsLoading">
              <td colspan="5" class="px-6 py-10 text-center text-gray-400">
                <UIcon name="i-lucide-loader" class="animate-spin w-5 h-5 mx-auto mb-2" />
                Memuat data admin...
              </td>
            </tr>
            <tr v-else-if="filteredAdmins.length === 0">
              <td colspan="5" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">
                Tidak ada data admin yang ditemukan.
              </td>
            </tr>
            <tr
              v-for="admin in filteredAdmins"
              :key="admin.id"
              class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
            >
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                  <UAvatar
                    :alt="admin.name"
                    size="md"
                    :class="[
                      'font-bold',
                      admin.role === 'super_admin'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    ]"
                  />
                  <div>
                    <div class="font-bold text-gray-900 dark:text-white">{{ admin.name }}</div>
                    <div class="text-xs text-gray-400">ID: {{ admin.id }}</div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-300">
                {{ admin.email }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <UBadge
                  :color="admin.role === 'super_admin' ? 'warning' : 'info'"
                  variant="soft"
                  size="xs"
                  class="font-bold"
                >
                  {{ admin.role === 'super_admin' ? 'Super Admin' : 'Staff Admin' }}
                </UBadge>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                {{ formatDate(admin.createdAt) }}
              </td>
              <td v-if="user?.role === 'super_admin'" class="px-6 py-4 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-edit-2"
                    size="xs"
                    @click="openAdminModal(admin)"
                  />
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    size="xs"
                    @click="deleteAdmin(admin.id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Form Admin (Nuxt UI UModal) -->
    <UModal
      v-model:open="isModalOpen"
      :title="editingAdmin ? 'Edit Data Admin' : 'Tambah Admin Baru'"
      description="Isi form untuk membuat atau mengubah akun tim admin."
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            v-if="errorMsg"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :description="errorMsg"
          />

          <UFormField label="Nama Lengkap" required>
            <UInput v-model="adminForm.name" placeholder="Contoh: Budi Santoso" class="w-full" />
          </UFormField>

          <UFormField label="Alamat Email" required>
            <UInput v-model="adminForm.email" type="email" placeholder="budi@ggtix.com" class="w-full" />
          </UFormField>

          <UFormField :label="editingAdmin ? 'Password Baru (Kosongkan jika tidak diubah)' : 'Password'" :required="!editingAdmin">
            <UInput v-model="adminForm.password" type="password" placeholder="••••••••" class="w-full" />
          </UFormField>

          <UFormField label="Role / Hak Akses" required>
            <USelect v-model="adminForm.role" :items="roleOptions" class="w-full" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" @click="isModalOpen = false">
            Batal
          </UButton>
          <UButton
            :loading="isSaving"
            class="bg-[#1B1330] hover:bg-[#2A1F49] text-white"
            @click="saveAdmin"
          >
            {{ editingAdmin ? 'Simpan Perubahan' : 'Tambah Admin' }}
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
