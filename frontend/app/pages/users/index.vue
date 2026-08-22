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
  role: 'super_admin' | 'admin' | 'gate_staff' | string
  createdAt: string
}

const { request } = useApi()
const { user } = useAuth()
const toast = useToast()

// State
const activeTab = ref<'customers' | 'admins'>('customers')
const customerSearch = ref('')
const adminSearch = ref('')
const customersLoading = ref(false)
const adminsLoading = ref(false)

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
  role: 'admin' as 'gate_staff' | 'admin' | 'super_admin'
})

const roleOptions = [
  { label: 'Super Admin (Akses Penuh Master Platform)', value: 'super_admin' },
  { label: 'Admin (Operasional Event, Venue & Order)', value: 'admin' },
  { label: 'Gate Staff (Petugas Scan Tiket Venue)', value: 'gate_staff' }
]

// Data Fetching
async function loadCustomers() {
  customersLoading.value = true
  try {
    const res = await request<{ data: CustomerUser[] }>('/users/customers', {
      query: { search: customerSearch.value || undefined, limit: 50 }
    })
    customers.value = res?.data ?? []
  } catch (err: any) {
    customers.value = []
    toast.add({ title: 'Gagal memuat data pelanggan', color: 'error' })
  } finally {
    customersLoading.value = false
  }
}

async function loadAdmins() {
  adminsLoading.value = true
  try {
    const res = await request<{ data: AdminUser[] }>('/users/admins', {
      query: { search: adminSearch.value || undefined, limit: 50 }
    })
    admins.value = res?.data ?? []
  } catch (err: any) {
    admins.value = []
    toast.add({ title: 'Gagal memuat data admin', color: 'error' })
  } finally {
    adminsLoading.value = false
  }
}

let customerDebounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedLoadCustomers() {
  if (customerDebounceTimer) clearTimeout(customerDebounceTimer)
  customerDebounceTimer = setTimeout(loadCustomers, 300)
}

let adminDebounceTimer: ReturnType<typeof setTimeout> | null = null
function debouncedLoadAdmins() {
  if (adminDebounceTimer) clearTimeout(adminDebounceTimer)
  adminDebounceTimer = setTimeout(loadAdmins, 300)
}

// Modal Handlers
function openAdminModal(admin?: AdminUser) {
  editingAdmin.value = admin || null
  errorMsg.value = ''
  if (admin) {
    adminForm.name = admin.name
    adminForm.email = admin.email
    adminForm.password = ''
    adminForm.role = (admin.role as 'gate_staff' | 'admin' | 'super_admin') || 'admin'
  } else {
    adminForm.name = ''
    adminForm.email = ''
    adminForm.password = ''
    adminForm.role = 'admin'
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
      toast.add({ title: 'Data admin berhasil diperbarui', color: 'success' })
    } else {
      await request<{ data: AdminUser }>('/users/admins', {
        method: 'POST',
        body: payload
      })
      toast.add({ title: 'Admin baru berhasil ditambahkan', color: 'success' })
    }
    isModalOpen.value = false
    await loadAdmins()
  } catch (err: any) {
    errorMsg.value = err?.data?.error || err?.data?.message || 'Gagal menyimpan data admin.'
  } finally {
    isSaving.value = false
  }
}

async function deleteAdmin(id: string) {
  if (!confirm('Yakin ingin menghapus admin ini?')) return
  try {
    await request(`/users/admins/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Admin berhasil dihapus', color: 'success' })
    admins.value = admins.value.filter((a) => a.id !== id)
  } catch (err: any) {
    toast.add({ title: err?.data?.error || 'Gagal menghapus admin', color: 'error' })
  }
}

function formatDate(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

onMounted(() => {
  loadCustomers()
  loadAdmins()
})
</script>

<template>
  <div class="space-y-5">
    <!-- Header Page -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          Manajemen Data Pengguna
        </h1>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Kelola data akun pelanggan (customer) dan tim admin GGTIX (/api/users)
        </p>
      </div>

      <!-- Action Button for Super Admin -->
      <UButton
        v-if="activeTab === 'admins' && user?.role === 'super_admin'"
        color="primary"
        icon="i-lucide-user-plus"
        size="sm"
        class="font-medium text-xs shadow-xs"
        @click="openAdminModal()"
      >
        Tambah Admin
      </UButton>
    </div>

    <!-- Stats Summary KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Pelanggan</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ customers.length }}</h3>
          <p class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-trending-up" class="w-3 h-3" />
            Terdaftar di platform
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <UIcon name="i-lucide-users" class="w-5 h-5" />
        </div>
      </div>

      <div class="p-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs flex items-center justify-between">
        <div>
          <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tim Admin & Staff</p>
          <h3 class="text-xl font-bold text-gray-900 dark:text-white mt-0.5 tracking-tight">{{ admins.length }}</h3>
          <p class="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
            <UIcon name="i-lucide-shield-check" class="w-3 h-3" />
            Pengelola internal
          </p>
        </div>
        <div class="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <UIcon name="i-lucide-user-cog" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- Navigation Pills / Tabs & Search -->
    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/80 dark:border-gray-800 shadow-xs">
      <!-- Tabs Switcher -->
      <div class="inline-flex p-1 rounded-lg bg-gray-100 dark:bg-gray-800 w-full sm:w-auto">
        <button
          type="button"
          :class="[
            'flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
            activeTab === 'customers'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          ]"
          @click="activeTab = 'customers'"
        >
          <UIcon name="i-lucide-users" class="w-3.5 h-3.5 text-emerald-500" />
          <span>Data Pelanggan ({{ customers.length }})</span>
        </button>

        <button
          v-if="user?.role === 'super_admin'"
          type="button"
          :class="[
            'flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all',
            activeTab === 'admins'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          ]"
          @click="activeTab = 'admins'"
        >
          <UIcon name="i-lucide-shield-check" class="w-3.5 h-3.5 text-amber-500" />
          <span>Tim Admin ({{ admins.length }})</span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="w-full sm:w-64">
        <UInput
          v-if="activeTab === 'customers'"
          v-model="customerSearch"
          icon="i-lucide-search"
          placeholder="Cari nama / email..."
          size="sm"
          class="w-full text-xs"
          @input="debouncedLoadCustomers"
        />
        <UInput
          v-else
          v-model="adminSearch"
          icon="i-lucide-search"
          placeholder="Cari nama / email admin..."
          size="sm"
          class="w-full text-xs"
          @input="debouncedLoadAdmins"
        />
      </div>
    </div>

    <!-- TAB 1: DATA PELANGGAN -->
    <div v-if="activeTab === 'customers'">
      <div class="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" class="px-4 py-3">Pelanggan</th>
              <th scope="col" class="px-4 py-3">Alamat Email</th>
              <th scope="col" class="px-4 py-3">Tipe Akun</th>
              <th scope="col" class="px-4 py-3 text-right">Tanggal Terdaftar</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
            <tr v-if="customersLoading">
              <td colspan="4" class="px-4 py-8 text-center text-gray-400 text-xs">
                <UIcon name="i-lucide-loader" class="animate-spin w-4 h-4 mx-auto mb-1.5" />
                Memuat data pelanggan...
              </td>
            </tr>
            <tr v-else-if="customers.length === 0">
              <td colspan="4" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
                Tidak ada data pelanggan yang ditemukan.
              </td>
            </tr>
            <tr
              v-for="customer in customers"
              :key="customer.id"
              class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
            >
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center gap-2.5">
                  <UAvatar
                    :alt="customer.name"
                    size="sm"
                    class="bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-xs"
                  />
                  <div class="font-semibold text-xs text-gray-900 dark:text-white">{{ customer.name }}</div>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300 text-xs">
                {{ customer.email }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <UBadge color="success" variant="soft" size="sm" class="font-bold px-2.5 py-0.5 text-[11px] tracking-wide rounded-md shadow-2xs">
                  Customer
                </UBadge>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-right text-gray-500 dark:text-gray-400 text-xs">
                {{ formatDate(customer.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TAB 2: TIM ADMIN -->
    <div v-if="activeTab === 'admins'">
      <div class="overflow-x-auto rounded-xl border border-gray-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xs">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th scope="col" class="px-4 py-3">Anggota Tim Admin</th>
              <th scope="col" class="px-4 py-3">Email</th>
              <th scope="col" class="px-4 py-3">Hak Akses (Role)</th>
              <th scope="col" class="px-4 py-3">Terdaftar</th>
              <th v-if="user?.role === 'super_admin'" scope="col" class="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
            <tr v-if="adminsLoading">
              <td colspan="5" class="px-4 py-8 text-center text-gray-400 text-xs">
                <UIcon name="i-lucide-loader" class="animate-spin w-4 h-4 mx-auto mb-1.5" />
                Memuat data admin...
              </td>
            </tr>
            <tr v-else-if="admins.length === 0">
              <td colspan="5" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
                Tidak ada data admin yang ditemukan.
              </td>
            </tr>
            <tr
              v-for="admin in admins"
              :key="admin.id"
              class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors"
            >
              <td class="px-4 py-3 whitespace-nowrap">
                <div class="flex items-center gap-2.5">
                  <UAvatar
                    :alt="admin.name"
                    size="sm"
                    :class="[
                      'font-bold text-xs',
                      admin.role === 'super_admin'
                        ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                        : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                    ]"
                  />
                  <div class="font-semibold text-xs text-gray-900 dark:text-white">{{ admin.name }}</div>
                </div>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300 text-xs">
                {{ admin.email }}
              </td>
              <td class="px-4 py-3 whitespace-nowrap">
                <UBadge
                  :color="admin.role === 'super_admin' ? 'warning' : admin.role === 'admin' ? 'primary' : 'info'"
                  variant="soft"
                  size="sm"
                  class="font-bold px-2.5 py-0.5 text-[11px] tracking-wide rounded-md shadow-2xs"
                >
                  {{ admin.role === 'super_admin' ? 'Super Admin' : admin.role === 'admin' ? 'Admin Operasional' : 'Gate Staff' }}
                </UBadge>
              </td>
              <td class="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400 text-xs">
                {{ formatDate(admin.createdAt) }}
              </td>
              <td v-if="user?.role === 'super_admin'" class="px-4 py-3 whitespace-nowrap text-right">
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
        <div class="space-y-3.5 text-xs">
          <UAlert
            v-if="errorMsg"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            :description="errorMsg"
          />

          <UFormField label="Nama Lengkap" required>
            <UInput v-model="adminForm.name" placeholder="Contoh: Budi Santoso" size="sm" class="w-full text-xs" />
          </UFormField>

          <UFormField label="Alamat Email" required>
            <UInput v-model="adminForm.email" type="email" placeholder="budi@ggtix.com" size="sm" class="w-full text-xs" />
          </UFormField>

          <UFormField :label="editingAdmin ? 'Password Baru (Kosongkan jika tidak diubah)' : 'Password'" :required="!editingAdmin">
            <UInput v-model="adminForm.password" type="password" placeholder="••••••••" size="sm" class="w-full text-xs" />
          </UFormField>

          <UFormField label="Role / Hak Akses" required>
            <USelect v-model="adminForm.role" :items="roleOptions" size="sm" class="w-full text-xs" />
          </UFormField>
        </div>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <UButton color="neutral" variant="outline" size="sm" @click="isModalOpen = false">
            Batal
          </UButton>
          <UButton
            :loading="isSaving"
            size="sm"
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
