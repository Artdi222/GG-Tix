<script setup lang="ts">
const { request } = useApi()
const { user } = useAuth()
const toast = useToast()

// Tab Management
const activeTab = ref('profile')
const tabs = computed(() => {
  const allTabs = [
    { label: 'Profil & Keamanan', icon: 'i-lucide-user', value: 'profile' },
    { label: 'Preferensi Scanner', icon: 'i-lucide-scan', value: 'scanner' },
    { label: 'Konfigurasi Platform', icon: 'i-lucide-settings', value: 'config', hidden: user.value?.role !== 'super_admin' },
    { label: 'Audit Trail & Aktivitas', icon: 'i-lucide-file-text', value: 'audit', hidden: user.value?.role !== 'super_admin' },
    { label: 'Status Sistem & Diagnostik', icon: 'i-lucide-heart-pulse', value: 'status', hidden: user.value?.role !== 'super_admin' }
  ]
  return allTabs.filter(t => !t.hidden)
})

// Profile State
const profileForm = reactive({
  name: user.value?.name || '',
  email: user.value?.email || ''
})
const passwordForm = reactive({
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: ''
})
const profileLoading = ref(false)
const passwordLoading = ref(false)

// Scanner State (LocalStorage)
const scannerSettings = reactive({
  soundEnabled: true,
  soundVolume: 80,
  continuousMode: true,
  cameraFacing: 'environment'
})

function saveScannerSettings() {
  localStorage.setItem('scanner_settings', JSON.stringify(scannerSettings))
  toast.add({ title: 'Preferensi scanner disimpan.', color: 'success' })
}

function testBeep() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    gainNode.gain.value = (scannerSettings.soundVolume / 100) * 0.5
    oscillator.start()
    setTimeout(() => oscillator.stop(), 200)
  } catch (e) {
    console.error('Audio context error:', e)
  }
}

// Settings State (Super Admin)
const systemSettings = reactive({
  defaultMaxTicketsPerOrder: 4,
  pendingOrderExpiryMinutes: 15,
  supportEmail: 'support@ggtix.id',
  supportWhatsapp: '+6281234567890',
  maintenanceMode: false
})

const settingsLoading = ref(false)

async function loadSettings() {
  try {
    const res = await request<{ data: typeof systemSettings }>('/settings/system')
    if (res?.data) {
      Object.assign(systemSettings, res.data)
    }
  } catch (e) {
    console.error(e)
  }
}

async function saveSettings() {
  settingsLoading.value = true
  try {
    await request('/settings/system', { method: 'PATCH', body: systemSettings })
    toast.add({ title: 'Pengaturan berhasil diperbarui.', color: 'success' })
  } catch (e) {
    toast.add({ title: 'Gagal memperbarui pengaturan.', color: 'error' })
  } finally {
    settingsLoading.value = false
  }
}

// Audit Logs State
const auditLogs = ref<any[]>([])
const auditPagination = ref({ page: 1, totalPages: 1, totalCount: 0 })
const auditSearch = ref('')
const auditMethod = ref('ALL')
const auditLoading = ref(false)

async function loadAuditLogs() {
  auditLoading.value = true
  try {
    const rawMethod = auditMethod.value as any
    const methodStr = typeof rawMethod === 'object' && rawMethod !== null ? rawMethod.value : rawMethod
    const methodFilter = (methodStr && methodStr !== 'ALL') ? methodStr : undefined

    const res = await request<{ data: any[], pagination: any }>('/settings/audit-logs', {
      query: {
        page: auditPagination.value.page,
        search: auditSearch.value || undefined,
        method: methodFilter
      }
    })
    auditLogs.value = res?.data || []
    if (res?.pagination) {
      auditPagination.value = res.pagination
    }
  } catch (e) {
    console.error(e)
  } finally {
    auditLoading.value = false
  }
}

// Diagnostics State
const diagnostics = ref<any>(null)
async function loadDiagnostics() {
  try {
    const res = await request<{ data: any }>('/settings/diagnostics')
    diagnostics.value = res?.data || null
  } catch (e) {
    console.error(e)
  }
}

watch(activeTab, (tab) => {
  if (tab === 'config') loadSettings()
  if (tab === 'audit') loadAuditLogs()
  if (tab === 'status') loadDiagnostics()
})

// Unified onMounted
onMounted(() => {
  const saved = localStorage.getItem('scanner_settings')
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      if (typeof parsed.soundVolume === 'string') parsed.soundVolume = Number(parsed.soundVolume)
      Object.assign(scannerSettings, parsed)
    } catch {
      // Ignore
    }
  }
})

async function updateProfile() {
  profileLoading.value = true
  try {
    await request('/auth/profile', { method: 'PATCH', body: profileForm })
    toast.add({ title: 'Profil Anda berhasil diperbarui.', color: 'success' })
    if (user.value) {
      user.value.name = profileForm.name
      user.value.email = profileForm.email
    }
  } catch (e) {
    toast.add({ title: 'Gagal memperbarui profil.', color: 'error' })
  } finally {
    profileLoading.value = false
  }
}

async function changePassword() {
  if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
    toast.add({ title: 'Konfirmasi kata sandi tidak sesuai.', color: 'error' })
    return
  }
  passwordLoading.value = true
  try {
    await request('/auth/change-password', { method: 'PATCH', body: passwordForm })
    toast.add({ title: 'Kata sandi berhasil diubah.', color: 'success' })
    passwordForm.currentPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmNewPassword = ''
  } catch (e: any) {
    toast.add({
      title: e?.data?.message || 'Gagal mengubah kata sandi. Pastikan kata sandi saat ini benar.',
      color: 'error'
    })
  } finally {
    passwordLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header Page -->
    <div>
      <h1 class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
        Pengaturan Sistem
      </h1>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
        Kelola profil akun pribadi, preferensi pemindai tiket, konfigurasi bisnis, dan log aktivitas platform.
      </p>
    </div>

    <!-- Navigation Pills / Custom Tabs Switcher -->
    <div class="flex flex-wrap gap-2 p-1.5 rounded-xl bg-gray-100 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 w-fit">
      <button
        v-for="t in tabs"
        :key="t.value"
        type="button"
        :class="[
          'flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all',
          activeTab === t.value
            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
        ]"
        @click="activeTab = t.value"
      >
        <UIcon :name="t.icon" class="w-4 h-4" />
        <span>{{ t.label }}</span>
      </button>
    </div>

    <!-- TAB 1: PROFIL & KEAMANAN -->
    <div v-if="activeTab === 'profile'" key="profile" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-2 space-y-6">
        <!-- Form Profile -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
          <div class="mb-4">
            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Informasi Profil</h3>
            <p class="text-xs text-gray-500">Perbarui identitas dan alamat email yang terdaftar.</p>
          </div>
          <form @submit.prevent="updateProfile" class="space-y-4 text-xs">
            <UFormField label="Nama Lengkap" required>
              <UInput v-model="profileForm.name" size="sm" class="w-full text-xs" />
            </UFormField>
            <UFormField label="Alamat Email" required>
              <UInput v-model="profileForm.email" type="email" size="sm" class="w-full text-xs" />
            </UFormField>
            <div class="flex justify-end pt-2">
              <UButton type="submit" :loading="profileLoading" size="sm" class="bg-[#1B1330] hover:bg-[#2A1F49] text-white">
                Simpan Profil
              </UButton>
            </div>
          </form>
        </div>

        <!-- Form Password -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
          <div class="mb-4">
            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Ganti Kata Sandi</h3>
            <p class="text-xs text-gray-500">Pastikan akun Anda menggunakan kata sandi yang kuat.</p>
          </div>
          <form @submit.prevent="changePassword" class="space-y-4 text-xs">
            <UFormField label="Kata Sandi Saat Ini" required>
              <UInput v-model="passwordForm.currentPassword" type="password" placeholder="••••••••" size="sm" class="w-full text-xs" />
            </UFormField>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <UFormField label="Kata Sandi Baru" required>
                <UInput v-model="passwordForm.newPassword" type="password" placeholder="Minimal 6 karakter" size="sm" class="w-full text-xs" />
              </UFormField>
              <UFormField label="Konfirmasi Kata Sandi Baru" required>
                <UInput v-model="passwordForm.confirmNewPassword" type="password" placeholder="Ulangi kata sandi baru" size="sm" class="w-full text-xs" />
              </UFormField>
            </div>
            <div class="flex justify-end pt-2">
              <UButton type="submit" :loading="passwordLoading" color="error" variant="soft" size="sm">
                Perbarui Kata Sandi
              </UButton>
            </div>
          </form>
        </div>
      </div>

      <!-- Profile Identity Summary Card -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-6 shadow-xs h-fit">
        <div class="flex flex-col items-center text-center">
          <UAvatar
            size="3xl"
            :alt="user?.name || 'Admin'"
            class="mb-3.5 ring-4 ring-[#F2A93B]/20 font-bold text-base"
          />
          <h4 class="font-bold text-base text-gray-900 dark:text-white">{{ user?.name || 'Admin GGTIX' }}</h4>
          <p class="text-xs text-gray-500 mb-3">{{ user?.email || 'admin@ggtix.com' }}</p>
          <UBadge
            :color="user?.role === 'super_admin' ? 'warning' : user?.role === 'admin' ? 'primary' : 'info'"
            variant="soft"
            size="sm"
            class="font-bold px-2.5 py-0.5 text-[11px] tracking-wide rounded-md shadow-2xs"
          >
            {{ user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin Operasional' : 'Gate Staff' }}
          </UBadge>

          <div class="mt-6 w-full text-left space-y-2.5 text-xs text-gray-500 dark:text-gray-400">
            <div class="flex justify-between border-b border-gray-100 dark:border-gray-800/80 pb-2">
              <span>Admin ID</span>
              <span class="font-mono text-gray-900 dark:text-white truncate max-w-35">{{ user?.id }}</span>
            </div>
            <div class="flex justify-between">
              <span>Platform</span>
              <span class="font-medium text-gray-900 dark:text-white">GGTIX Internal Console</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: PREFERENSI SCANNER -->
    <div v-if="activeTab === 'scanner'" key="scanner" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-6 shadow-xs max-w-2xl">
      <div class="space-y-6 text-xs">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Audio Feedback Beep</h3>
            <p class="text-xs text-gray-500">Aktifkan efek suara otomatis saat verifikasi QR code berhasil di scan.</p>
          </div>
          <USwitch v-model="scannerSettings.soundEnabled" />
        </div>

        <div v-if="scannerSettings.soundEnabled" class="space-y-2 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div class="flex justify-between text-xs font-semibold">
            <span>Volume Suara Beep</span>
            <span class="text-primary-600 dark:text-primary-400">{{ scannerSettings.soundVolume }}%</span>
          </div>
          <USlider v-model="scannerSettings.soundVolume" :min="0" :max="100" />
          <div class="flex justify-end pt-1">
            <UButton label="Uji Coba Suara (Test Beep)" variant="outline" size="xs" icon="i-lucide-volume-2" @click="testBeep" />
          </div>
        </div>

        <USeparator />

        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-sm font-bold text-gray-900 dark:text-white">Continuous Scanning Mode</h3>
            <p class="text-xs text-gray-500">Kamera bersiap memindai tiket berikutnya dalam jeda 2 detik tanpa perlu klik tombol lagi.</p>
          </div>
          <USwitch v-model="scannerSettings.continuousMode" />
        </div>

        <USeparator />

        <UFormField label="Orientasi Kamera Default">
          <USelect
            v-model="scannerSettings.cameraFacing"
            :items="[
              { label: 'Kamera Belakang (Environment / Disarankan)', value: 'environment' },
              { label: 'Kamera Depan (User)', value: 'user' }
            ]"
            size="sm"
            class="w-full text-xs"
          />
        </UFormField>

        <div class="pt-4 flex justify-end">
          <UButton size="sm" class="bg-[#1B1330] hover:bg-[#2A1F49] text-white" @click="saveScannerSettings">
            Simpan Preferensi Scanner
          </UButton>
        </div>
      </div>
    </div>

    <!-- TAB 3: KONFIGURASI PLATFORM -->
    <div v-if="activeTab === 'config'" key="config" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-6 shadow-xs max-w-2xl space-y-6">
      <div>
        <h3 class="text-sm font-bold text-gray-900 dark:text-white">Parameter Bisnis Global</h3>
        <p class="text-xs text-gray-500">Konfigurasi batasan transaksi pesanan dan kontak customer service resmi.</p>
      </div>

      <form @submit.prevent="saveSettings" class="space-y-5 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Maksimal Tiket / Order" description="Batas standar tiket per transaksi (1-10)">
            <UInput v-model.number="systemSettings.defaultMaxTicketsPerOrder" type="number" :min="1" :max="10" size="sm" class="w-full text-xs" />
          </UFormField>

          <UFormField label="Batas Waktu Bayar (Menit)" description="Timeout pesanan pending sebelum hangus">
            <UInput v-model.number="systemSettings.pendingOrderExpiryMinutes" type="number" :min="5" :max="120" size="sm" class="w-full text-xs" />
          </UFormField>
        </div>

        <UFormField label="Email Customer Support" description="Ditampilkan pada tiket digital untuk komplain">
          <UInput v-model="systemSettings.supportEmail" type="email" placeholder="support@ggtix.id" size="sm" class="w-full text-xs" />
        </UFormField>

        <UFormField label="WhatsApp Helpdesk Venue" description="Kontak cepat darurat penonton di venue">
          <UInput v-model="systemSettings.supportWhatsapp" placeholder="+6281234567890" size="sm" class="w-full text-xs" />
        </UFormField>

        <USeparator />

        <div class="flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-200 dark:border-rose-900/60">
          <div>
            <h4 class="text-xs font-bold text-rose-700 dark:text-rose-400">Mode Pemeliharaan (Maintenance Mode)</h4>
            <p class="text-[11px] text-rose-600/80 dark:text-rose-400/80">Aktifkan untuk menonaktifkan transaksi publik sementara saat maintenance server.</p>
          </div>
          <USwitch v-model="systemSettings.maintenanceMode" color="error" />
        </div>

        <div class="pt-2 flex justify-end">
          <UButton type="submit" :loading="settingsLoading" size="sm" class="bg-[#1B1330] hover:bg-[#2A1F49] text-white">
            Simpan Konfigurasi Platform
          </UButton>
        </div>
      </form>
    </div>

    <!-- TAB 4: AUDIT TRAIL & AKTIVITAS -->
    <div v-if="activeTab === 'audit'" key="audit" class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-xs overflow-hidden">
      <div class="p-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <UInput v-model="auditSearch" placeholder="Cari path / email / ID..." size="sm" class="w-64 text-xs" icon="i-lucide-search" @keydown.enter="loadAuditLogs" />
          <USelect
            v-model="auditMethod"
            :items="[
              { label: 'Semua Method', value: 'ALL' },
              { label: 'POST', value: 'POST' },
              { label: 'PUT', value: 'PUT' },
              { label: 'PATCH', value: 'PATCH' },
              { label: 'DELETE', value: 'DELETE' }
            ]"
            size="sm"
            class="w-36 text-xs"
            @update:model-value="loadAuditLogs"
          />
        </div>
        <UButton icon="i-lucide-refresh-cw" size="sm" variant="outline" :loading="auditLoading" @click="loadAuditLogs">
          Segarkan Data
        </UButton>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800 text-left text-xs">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider text-[11px]">
            <tr>
              <th class="px-4 py-3">Waktu Eksekusi</th>
              <th class="px-4 py-3">Admin / User</th>
              <th class="px-4 py-3">Metode</th>
              <th class="px-4 py-3">Resource Path</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3 text-right">IP Address</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800/80 text-gray-700 dark:text-gray-300">
            <template v-if="auditLoading">
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-400 text-xs">
                  <UIcon name="i-lucide-loader" class="animate-spin w-4 h-4 mx-auto mb-1.5" />
                  Memuat riwayat audit log...
                </td>
              </tr>
            </template>
            <template v-else-if="auditLogs.length === 0">
              <tr>
                <td colspan="6" class="px-4 py-8 text-center text-gray-400 dark:text-gray-500 text-xs">
                  Belum ada aktivitas audit log yang tercatat.
                </td>
              </tr>
            </template>
            <template v-else>
              <tr v-for="log in auditLogs" :key="log.id" class="hover:bg-gray-50/50 dark:hover:bg-gray-800/25 transition-colors">
                <td class="px-4 py-3 whitespace-nowrap text-gray-500 dark:text-gray-400">
                  {{ new Date(log.createdAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'medium' }) }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <div class="font-medium text-gray-900 dark:text-white">{{ log.userName || log.userEmail || (log.userId ? 'Admin (' + log.userId.slice(0, 8) + '...)' : 'System') }}</div>
                  <div class="text-[10px] text-gray-400">
                    <span v-if="log.userName && log.userEmail" class="mr-1">{{ log.userEmail }} •</span>
                    <span class="capitalize">{{ log.userRole || 'Admin' }}</span>
                  </div>
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <UBadge
                    :color="log.method === 'POST' ? 'success' : log.method === 'PUT' || log.method === 'PATCH' ? 'warning' : 'error'"
                    variant="subtle"
                    size="xs"
                    class="font-mono text-[10px] font-bold"
                  >
                    {{ log.method }}
                  </UBadge>
                </td>
                <td class="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-gray-600 dark:text-gray-300 max-w-50 truncate">
                  {{ log.path }}
                </td>
                <td class="px-4 py-3 whitespace-nowrap">
                  <UBadge
                    :color="log.statusCode < 300 ? 'success' : log.statusCode < 500 ? 'warning' : 'error'"
                    variant="soft"
                    size="xs"
                    class="font-bold font-mono text-[10px]"
                  >
                    {{ log.statusCode }}
                  </UBadge>
                </td>
                <td class="px-4 py-3 whitespace-nowrap text-right font-mono text-gray-500 text-xs">
                  {{ log.ip }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-xs text-gray-500">
        <span>Total: {{ auditPagination.totalCount }} entri</span>
        <UPagination
          v-if="auditPagination.totalCount > 0"
          v-model:page="auditPagination.page"
          :items-per-page="15"
          :total="auditPagination.totalCount"
          size="sm"
          @update:page="loadAuditLogs"
        />
      </div>
    </div>

    <!-- TAB 5: STATUS SISTEM & DIAGNOSTIK -->
    <div v-if="activeTab === 'status'" key="status" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-xs text-gray-500 uppercase tracking-wider">Database</h3>
            <div class="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
              <UIcon name="i-lucide-database" class="w-4 h-4" />
            </div>
          </div>
          <div class="text-xl font-bold tracking-tight text-gray-900 dark:text-white capitalize">
            {{ diagnostics?.database?.status === 'healthy' ? 'Terhubung' : 'Offline' }}
          </div>
        </div>
        <p class="text-[11px] text-gray-400 mt-2 font-mono">Ping: {{ diagnostics?.database?.latencyMs ?? 0 }}ms</p>
      </div>

      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-xs text-gray-500 uppercase tracking-wider">Storage Bucket</h3>
            <div class="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
              <UIcon name="i-lucide-hard-drive" class="w-4 h-4" />
            </div>
          </div>
          <div class="text-xl font-bold tracking-tight text-gray-900 dark:text-white capitalize">
            {{ diagnostics?.storage?.status === 'healthy' ? 'Siap Digunakan' : 'Belum di Konfigurasi' }}
          </div>
        </div>
        <p class="text-[11px] text-gray-400 mt-2">{{ diagnostics?.storage?.provider || 'Backblaze B2' }}</p>
      </div>

      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-xs text-gray-500 uppercase tracking-wider">Payment Gateway</h3>
            <div class="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
              <UIcon name="i-lucide-credit-card" class="w-4 h-4" />
            </div>
          </div>
          <div class="text-xl font-bold tracking-tight text-gray-900 dark:text-white capitalize">
            {{ diagnostics?.paymentGateway?.status === 'healthy' ? 'Aktif' : 'Nonaktif' }}
          </div>
        </div>
        <p class="text-[11px] text-gray-400 mt-2 capitalize">Mode: {{ diagnostics?.paymentGateway?.environment || 'Sandbox' }}</p>
      </div>

      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 p-5 shadow-xs flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="font-bold text-xs text-gray-500 uppercase tracking-wider">Runtime & Server</h3>
            <div class="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <UIcon name="i-lucide-server" class="w-4 h-4" />
            </div>
          </div>
          <div class="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            {{ diagnostics?.runtime?.platform || 'Bun / Hono' }}
          </div>
        </div>
        <p class="text-[11px] text-gray-400 mt-2">
          Uptime: {{ Math.floor((diagnostics?.runtime?.uptimeSeconds || 0) / 60) }} Menit
        </p>
      </div>
    </div>
  </div>
</template>
