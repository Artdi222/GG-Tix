<script setup lang="ts">
interface Customer {
  id: string
  name: string
  email: string
  createdAt: string
}

interface Admin {
  id: string
  name: string
  email: string
  role: 'super_admin' | 'staff'
  createdAt: string
}

const { request } = useApi()
const { user } = useAuth()

const activeTab = ref<'customers' | 'admins'>('customers')
const customerSearch = ref('')
const adminSearch = ref('')
const customersLoading = ref(false)
const adminsLoading = ref(false)
const customers = ref<Customer[]>([
  { id: 'cust-1', name: 'Sari Dewi', email: 'sari@example.com', createdAt: '2026-08-01T10:00:00Z' },
  { id: 'cust-2', name: 'Andi Pratama', email: 'andi@example.com', createdAt: '2026-08-02T14:30:00Z' },
  { id: 'cust-3', name: 'Rina Kartika', email: 'rina@example.com', createdAt: '2026-08-03T09:15:00Z' }
])
const admins = ref<Admin[]>([
  { id: 'adm-1', name: 'Budi Santoso', email: 'budi@ggtix.com', role: 'super_admin', createdAt: '2026-07-15T08:00:00Z' },
  { id: 'adm-2', name: 'Artdi', email: 'artdi@ggtix.com', role: 'super_admin', createdAt: '2026-07-15T08:00:00Z' },
  { id: 'adm-3', name: 'Siti Rahayu', email: 'siti@ggtix.com', role: 'staff', createdAt: '2026-07-20T10:00:00Z' }
])

const showAdminModal = ref(false)
const editingAdmin = ref<Admin | null>(null)
const isSavingAdmin = ref(false)
const modalError = ref('')

const adminForm = reactive({
  name: '',
  email: '',
  password: '',
  role: 'staff' as 'super_admin' | 'staff'
})

const roleOptions = [
  { label: 'Staff Admin', value: 'staff' },
  { label: 'Super Admin', value: 'super_admin' }
]

async function loadCustomers() {
  customersLoading.value = true
  try {
    const res = await request<{ data: Customer[] }>('/users/customers', {
      query: { search: customerSearch.value, limit: 50 }
    })
    if (res?.data) {
      customers.value = res.data
    }
  } catch (error) {
    // Keep mock data if BE is offline
  } finally {
    customersLoading.value = false
  }
}

async function loadAdmins() {
  adminsLoading.value = true
  try {
    const res = await request<{ data: Admin[] }>('/users/admins', {
      query: { search: adminSearch.value, limit: 50 }
    })
    if (res?.data) {
      admins.value = res.data
    }
  } catch (error) {
    // Keep mock data if BE is offline
  } finally {
    adminsLoading.value = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const debouncedLoadCustomers = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadCustomers, 300)
}
const debouncedLoadAdmins = () => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadAdmins, 300)
}

function openAdminModal(admin?: Admin) {
  modalError.value = ''
  editingAdmin.value = admin || null
  if (admin) {
    adminForm.name = admin.name
    adminForm.email = admin.email
    adminForm.password = ''
    adminForm.role = admin.role
  } else {
    adminForm.name = ''
    adminForm.email = ''
    adminForm.password = ''
    adminForm.role = 'staff'
  }
  showAdminModal.value = true
}

function closeAdminModal() {
  showAdminModal.value = false
  editingAdmin.value = null
  modalError.value = ''
}

async function saveAdmin() {
  if (!adminForm.name || !adminForm.email) return
  if (!editingAdmin.value && !adminForm.password) {
    modalError.value = 'Password wajib diisi untuk admin baru.'
    return
  }

  isSavingAdmin.value = true
  modalError.value = ''

  try {
    const payload: Record<string, any> = {
      name: adminForm.name.trim(),
      email: adminForm.email.trim(),
      role: adminForm.role
    }
    if (adminForm.password) {
      payload.password = adminForm.password
    }

    if (editingAdmin.value) {
      await request(`/users/admins/${editingAdmin.value.id}`, {
        method: 'PUT',
        body: payload
      })
    } else {
      await request('/users/admins', {
        method: 'POST',
        body: payload
      })
    }
    closeAdminModal()
    loadAdmins()
  } catch (error: any) {
    modalError.value = error?.data?.error || error?.data?.message || 'Gagal menyimpan data admin.'
  } finally {
    isSavingAdmin.value = false
  }
}

async function deleteAdmin(id: string) {
  if (!confirm('Yakin ingin menghapus admin ini?')) return
  try {
    await request(`/users/admins/${id}`, { method: 'DELETE' })
    loadAdmins()
  } catch (error: any) {
    alert(error?.data?.error || error?.data?.message || 'Gagal menghapus admin')
  }
}

function formatDate(dateStr: string) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function getInitials(name: string) {
  if (!name) return 'U'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
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
          Kelola data akun pembeli tiket (pelanggan) dan pengelola sistem (tim admin)
        </p>
      </div>

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

    <!-- Navigation Tabs -->
    <div class="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-2">
      <button
        type="button"
        @click="activeTab = 'customers'"
        :class="[
          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200',
          activeTab === 'customers'
            ? 'bg-[#1B1330] text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
        ]"
      >
        <UIcon name="i-lucide-users" class="w-4 h-4" />
        <span>Pelanggan (Customers)</span>
        <UBadge color="neutral" variant="soft" size="xs" class="ml-1 font-mono">
          {{ customers.length }}
        </UBadge>
      </button>

      <button
        type="button"
        @click="activeTab = 'admins'"
        :class="[
          'flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200',
          activeTab === 'admins'
            ? 'bg-[#1B1330] text-white shadow-sm'
            : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800'
        ]"
      >
        <UIcon name="i-lucide-shield-check" class="w-4 h-4" />
        <span>Tim Admin</span>
        <UBadge color="neutral" variant="soft" size="xs" class="ml-1 font-mono">
          {{ admins.length }}
        </UBadge>
      </button>
    </div>

    <!-- ─── TAB 1: PELANGGAN (CUSTOMERS) ─── -->
    <div v-if="activeTab === 'customers'" class="space-y-4">
      <!-- Search Filter -->
      <div class="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm">
        <UInput
          v-model="customerSearch"
          icon="i-lucide-search"
          placeholder="Cari nama atau email pelanggan..."
          size="md"
          class="w-full sm:w-80"
          @input="debouncedLoadCustomers"
        />
      </div>

      <!-- Customers Table -->
      <div class="overflow-x-auto rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-xs">
            <tr>
              <th scope="col" class="px-6 py-4">Pelanggan</th>
              <th scope="col" class="px-6 py-4">Alamat Email</th>
              <th scope="col" class="px-6 py-4">Tanggal Terdaftar</th>
              <th scope="col" class="px-6 py-4 text-center">Status Akun</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
            <tr v-if="customersLoading">
              <td colspan="4" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">
                <UIcon name="i-lucide-loader" class="animate-spin w-5 h-5 mx-auto mb-2" />
                Memuat data pelanggan...
              </td>
            </tr>
            <tr v-else-if="customers.length === 0">
              <td colspan="4" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">
                Tidak ada data pelanggan yang ditemukan.
              </td>
            </tr>
            <tr
              v-for="customer in customers"
              :key="customer.id"
              class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
            >
              <!-- Name & Avatar -->
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/20 shrink-0">
                    {{ getInitials(customer.name) }}
                  </div>
                  <span class="font-bold text-gray-900 dark:text-white">{{ customer.name }}</span>
                </div>
              </td>

              <!-- Email -->
              <td class="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                {{ customer.email }}
              </td>

              <!-- Registered Date -->
              <td class="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-calendar" class="w-4 h-4 text-gray-400" />
                  <span>{{ formatDate(customer.createdAt) }}</span>
                </div>
              </td>

              <!-- Status -->
              <td class="px-6 py-4 whitespace-nowrap text-center">
                <UBadge color="success" variant="soft" size="xs" class="font-bold px-2 py-0.5">
                  Aktif
                </UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ─── TAB 2: TIM ADMIN ─── -->
    <div v-if="activeTab === 'admins'" class="space-y-4">
      <!-- Search Filter -->
      <div class="p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-sm flex items-center justify-between gap-4">
        <UInput
          v-model="adminSearch"
          icon="i-lucide-search"
          placeholder="Cari nama atau email admin..."
          size="md"
          class="w-full sm:w-80"
          @input="debouncedLoadAdmins"
        />
      </div>

      <!-- Admins Table -->
      <div class="overflow-x-auto rounded-2xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-sm">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-xs">
            <tr>
              <th scope="col" class="px-6 py-4">Pengelola</th>
              <th scope="col" class="px-6 py-4">Alamat Email</th>
              <th scope="col" class="px-6 py-4">Role / Akses</th>
              <th scope="col" class="px-6 py-4">Tanggal Dibuat</th>
              <th v-if="user?.role === 'super_admin'" scope="col" class="px-6 py-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
            <tr v-if="adminsLoading">
              <td colspan="5" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">
                <UIcon name="i-lucide-loader" class="animate-spin w-5 h-5 mx-auto mb-2" />
                Memuat data admin...
              </td>
            </tr>
            <tr v-else-if="admins.length === 0">
              <td colspan="5" class="px-6 py-10 text-center text-gray-400 dark:text-gray-500">
                Tidak ada data admin yang ditemukan.
              </td>
            </tr>
            <tr
              v-for="admin in admins"
              :key="admin.id"
              class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
            >
              <!-- Name & Avatar -->
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full bg-[#1B1330] text-white font-bold text-xs flex items-center justify-center shrink-0 border border-white/10">
                    {{ getInitials(admin.name) }}
                  </div>
                  <span class="font-bold text-gray-900 dark:text-white">{{ admin.name }}</span>
                </div>
              </td>

              <!-- Email -->
              <td class="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                {{ admin.email }}
              </td>

              <!-- Role Badge -->
              <td class="px-6 py-4 whitespace-nowrap">
                <UBadge
                  :color="admin.role === 'super_admin' ? 'warning' : 'neutral'"
                  variant="soft"
                  size="xs"
                  class="font-bold px-2 py-0.5"
                >
                  {{ admin.role === 'super_admin' ? 'Super Admin' : 'Staff Admin' }}
                </UBadge>
              </td>

              <!-- Registered Date -->
              <td class="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-calendar" class="w-4 h-4 text-gray-400" />
                  <span>{{ formatDate(admin.createdAt) }}</span>
                </div>
              </td>

              <!-- Actions (Super Admin only) -->
              <td v-if="user?.role === 'super_admin'" class="px-6 py-4 whitespace-nowrap text-right">
                <div class="flex items-center justify-end gap-1">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-edit-2"
                    size="xs"
                    aria-label="Edit Admin"
                    @click="openAdminModal(admin)"
                  />
                  <UButton
                    color="error"
                    variant="ghost"
                    icon="i-lucide-trash-2"
                    size="xs"
                    aria-label="Hapus Admin"
                    @click="deleteAdmin(admin.id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Form Admin -->
    <UModal
      v-model:open="showAdminModal"
      :title="editingAdmin ? 'Edit Data Admin' : 'Tambah Admin Baru'"
      description="Isi kredensial dan role hak akses pengelola konsol admin."
    >
      <template #body>
        <form class="space-y-4" @submit.prevent="saveAdmin">
          <UAlert
            v-if="modalError"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :description="modalError"
          />

          <UFormField label="Nama Lengkap" required>
            <UInput v-model="adminForm.name" placeholder="Contoh: Budi Santoso" class="w-full" />
          </UFormField>

          <UFormField label="Alamat Email" required>
            <UInput v-model="adminForm.email" type="email" placeholder="budi@ggtix.com" class="w-full" />
          </UFormField>

          <UFormField
            :label="editingAdmin ? 'Password Baru (Opsional)' : 'Password Utama'"
            :required="!editingAdmin"
          >
            <UInput
              v-model="adminForm.password"
              type="password"
              placeholder="••••••••"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Hak Akses (Role)" required>
            <USelect
              v-model="adminForm.role"
              :items="roleOptions"
              class="w-full"
            />
          </UFormField>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <UButton color="neutral" variant="outline" @click="closeAdminModal">
              Batal
            </UButton>
            <UButton
              type="submit"
              :loading="isSavingAdmin"
              class="bg-[#1B1330] hover:bg-[#2A1F49] text-white"
            >
              {{ editingAdmin ? 'Simpan Perubahan' : 'Tambah Admin' }}
            </UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
