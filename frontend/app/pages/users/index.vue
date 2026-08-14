<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Data Pengguna</h1>
    
    <div class="mb-6">
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8">
          <button
            @click="activeTab = 'customers'"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'customers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            Pelanggan
          </button>
          <button
            @click="activeTab = 'admins'"
            :class="[
              'py-4 px-1 border-b-2 font-medium text-sm',
              activeTab === 'admins'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            ]"
          >
            Tim Admin
          </button>
        </nav>
      </div>
    </div>

    <div v-if="activeTab === 'customers'">
      <div class="mb-4 flex justify-between items-center">
        <input
          v-model="customerSearch"
          type="text"
          placeholder="Cari pelanggan..."
          class="border rounded px-3 py-2 w-64"
          @input="debouncedLoadCustomers"
        />
      </div>
      
      <div v-if="customersLoading" class="text-center py-4">Loading...</div>
      <div v-else-if="customers.length === 0" class="text-center py-4 text-gray-500">Tidak ada data pelanggan</div>
      <div v-else class="bg-white shadow overflow-hidden rounded-lg">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terdaftar</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="customer in customers" :key="customer.id">
              <td class="px-6 py-4 whitespace-nowrap">{{ customer.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap">{{ customer.email }}</td>
              <td class="px-6 py-4 whitespace-nowrap">{{ new Date(customer.createdAt).toLocaleDateString('id-ID') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="activeTab === 'admins'">
      <div class="mb-4 flex justify-between items-center">
        <input
          v-model="adminSearch"
          type="text"
          placeholder="Cari admin..."
          class="border rounded px-3 py-2 w-64"
          @input="debouncedLoadAdmins"
        />
        <button
          v-if="user?.role === 'super_admin'"
          @click="openAdminModal()"
          class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          + Tambah Admin
        </button>
      </div>
      
      <div v-if="adminsLoading" class="text-center py-4">Loading...</div>
      <div v-else-if="admins.length === 0" class="text-center py-4 text-gray-500">Tidak ada data admin</div>
      <div v-else class="bg-white shadow overflow-hidden rounded-lg">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Terdaftar</th>
              <th v-if="user?.role === 'super_admin'" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="admin in admins" :key="admin.id">
              <td class="px-6 py-4 whitespace-nowrap">{{ admin.name }}</td>
              <td class="px-6 py-4 whitespace-nowrap">{{ admin.email }}</td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span :class="['px-2 py-1 text-xs rounded', admin.role === 'super_admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800']">
                  {{ admin.role === 'super_admin' ? 'Super Admin' : 'Staff' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">{{ new Date(admin.createdAt).toLocaleDateString('id-ID') }}</td>
              <td v-if="user?.role === 'super_admin'" class="px-6 py-4 whitespace-nowrap text-right text-sm">
                <button @click="openAdminModal(admin)" class="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                <button @click="deleteAdmin(admin.id)" class="text-red-600 hover:text-red-900">Hapus</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showAdminModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 class="text-xl font-bold mb-4">{{ editingAdmin ? 'Edit Admin' : 'Tambah Admin' }}</h2>
        <form @submit.prevent="saveAdmin">
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Nama</label>
            <input v-model="adminForm.name" type="text" required class="border rounded px-3 py-2 w-full" />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Email</label>
            <input v-model="adminForm.email" type="email" required class="border rounded px-3 py-2 w-full" />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Password {{ editingAdmin ? '(kosongkan jika tidak diubah)' : '' }}</label>
            <input v-model="adminForm.password" type="password" :required="!editingAdmin" class="border rounded px-3 py-2 w-full" />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium mb-1">Role</label>
            <select v-model="adminForm.role" class="border rounded px-3 py-2 w-full">
              <option value="staff">Staff</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" @click="closeAdminModal" class="px-4 py-2 border rounded hover:bg-gray-50">Batal</button>
            <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Simpan</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { request } = useApi()
const { user } = useAuth()

const activeTab = ref('customers')
const customerSearch = ref('')
const adminSearch = ref('')
const customersLoading = ref(false)
const adminsLoading = ref(false)
const customers = ref<any[]>([])
const admins = ref<any[]>([])
const showAdminModal = ref(false)
const editingAdmin = ref<any>(null)
const adminForm = ref({ name: '', email: '', password: '', role: 'staff' })

async function loadCustomers() {
  customersLoading.value = true
  try {
    const res = await request<any>('/users/customers', { query: { search: customerSearch.value, limit: 50 } })
    customers.value = res.data
  } catch (error) {
    console.error('Failed to load customers', error)
  } finally {
    customersLoading.value = false
  }
}

async function loadAdmins() {
  adminsLoading.value = true
  try {
    const res = await request<any>('/users/admins', { query: { search: adminSearch.value, limit: 50 } })
    admins.value = res.data
  } catch (error) {
    console.error('Failed to load admins', error)
  } finally {
    adminsLoading.value = false
  }
}

let debounceTimer: any = null
const debouncedLoadCustomers = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadCustomers, 300)
}
const debouncedLoadAdmins = () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(loadAdmins, 300)
}

function openAdminModal(admin?: any) {
  editingAdmin.value = admin || null
  if (admin) {
    adminForm.value = { name: admin.name, email: admin.email, password: '', role: admin.role }
  } else {
    adminForm.value = { name: '', email: '', password: '', role: 'staff' }
  }
  showAdminModal.value = true
}

function closeAdminModal() {
  showAdminModal.value = false
  editingAdmin.value = null
}

async function saveAdmin() {
  try {
    const payload: any = { name: adminForm.value.name, email: adminForm.value.email, role: adminForm.value.role }
    if (adminForm.value.password) payload.password = adminForm.value.password
    
    if (editingAdmin.value) {
      await request(`/users/admins/${editingAdmin.value.id}`, { method: 'PUT', body: payload })
    } else {
      await request('/users/admins', { method: 'POST', body: { ...payload, password: adminForm.value.password } })
    }
    closeAdminModal()
    loadAdmins()
  } catch (error: any) {
    alert(error.data?.message || 'Gagal menyimpan admin')
  }
}

async function deleteAdmin(id: string) {
  if (!confirm('Yakin ingin menghapus admin ini?')) return
  try {
    await request(`/users/admins/${id}`, { method: 'DELETE' })
    loadAdmins()
  } catch (error: any) {
    alert(error.data?.message || 'Gagal menghapus admin')
  }
}

watch(activeTab, (newTab) => {
  if (newTab === 'customers') loadCustomers()
  else loadAdmins()
})

onMounted(() => {
  loadCustomers()
})
</script>
