<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'

useHead({ title: 'Pengaturan' })

interface SystemSettings {
  defaultMaxTicketsPerOrder: number
  pendingOrderExpiryMinutes: number
  supportEmail: string
  supportWhatsapp: string
  maintenanceMode: boolean
}
interface AuditLog {
  id: string
  userEmail: string | null
  userName: string | null
  userRole: string | null
  method: string
  path: string
  statusCode: number
  ip: string
  durationMs: number | null
  createdAt: string
}
interface Diagnostics {
  database: { status: string, latencyMs: number }
  storage: { status: string, provider: string }
  paymentGateway: { status: string, environment: string }
  runtime: { platform: string, nodeEnv: string, uptimeSeconds: number }
}

const route = useRoute()
const router = useRouter()
const { request } = useApi()
const { user, isSuperAdmin, logout } = useAuth()
const toast = useToast()
const confirm = useConfirm()

const tabs = computed(() => [
  { label: 'Profil & keamanan', value: 'profile', icon: 'i-lucide-user-cog' },
  { label: 'Scanner', value: 'scanner', icon: 'i-lucide-scan-line' },
  ...(isSuperAdmin.value
    ? [
        { label: 'Platform', value: 'platform', icon: 'i-lucide-sliders-horizontal' },
        { label: 'Log audit', value: 'audit', icon: 'i-lucide-scroll-text' },
        { label: 'Status sistem', value: 'status', icon: 'i-lucide-activity' }
      ]
    : [])
])
const tab = computed({
  get: () => tabs.value.some(t => t.value === route.query.tab) ? String(route.query.tab) : 'profile',
  set: value => router.replace({ query: { tab: value } })
})

// Profile
const profile = reactive({ name: '', email: '' })
watch(user, (u) => {
  profile.name = u?.name ?? ''
  profile.email = u?.email ?? ''
}, { immediate: true })
const profileSaving = ref(false)
async function saveProfile() {
  if (profile.name.trim().length < 2) return toast.add({ title: 'Nama minimal 2 karakter', color: 'error' })
  profileSaving.value = true
  try {
    const res = await request<{ data: AdminUser }>('/auth/profile', { method: 'PATCH', body: { name: profile.name.trim(), email: profile.email.trim() } })
    user.value = res.data
    toast.add({ title: 'Profil diperbarui', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Profil gagal diperbarui', description: apiErrorMessage(err), color: 'error' })
  } finally {
    profileSaving.value = false
  }
}

const pw = reactive({ currentPassword: '', newPassword: '', confirmNewPassword: '' })
const pwSaving = ref(false)
const pwError = computed(() => {
  if (pw.newPassword && pw.newPassword.length < 8) return 'Minimal 8 karakter.'
  if (pw.confirmNewPassword && pw.confirmNewPassword !== pw.newPassword) return 'Konfirmasi tidak sama.'
  return ''
})
async function changePassword() {
  if (!pw.currentPassword || !pw.newPassword || pwError.value) return
  pwSaving.value = true
  try {
    await request('/auth/change-password', { method: 'PATCH', body: { ...pw } })
    // The backend revokes every session on password change; sign in again now
    // instead of being logged out unexpectedly when the access token expires.
    toast.add({ title: 'Kata sandi diubah', description: 'Silakan masuk kembali dengan kata sandi baru.', color: 'success' })
    await logout()
  } catch (err) {
    toast.add({ title: 'Kata sandi gagal diubah', description: apiErrorMessage(err), color: 'error' })
  } finally {
    pwSaving.value = false
  }
}

// Scanner
const { prefs, save: savePrefs } = useScannerPrefs()
function storePrefs() {
  toast.add(savePrefs()
    ? { title: 'Preferensi scanner disimpan di perangkat ini', color: 'success' }
    : { title: 'Browser memblokir penyimpanan lokal', color: 'error' })
}

// Platform
const settings = ref<SystemSettings | null>(null)
const settingsError = ref('')
const settingsSaving = ref(false)
// Last persisted value, to confirm only when maintenance is being switched on.
const savedMaintenance = ref(false)
async function loadSettings() {
  settingsError.value = ''
  try {
    settings.value = (await request<{ data: SystemSettings }>('/settings/system')).data
    savedMaintenance.value = settings.value.maintenanceMode
  } catch (err) {
    settingsError.value = apiErrorMessage(err, 'Pengaturan gagal dimuat.')
  }
}
async function saveSettings() {
  const s = settings.value
  if (!s) return
  if (s.maintenanceMode && !savedMaintenance.value) {
    const ok = await confirm({
      title: 'Aktifkan mode pemeliharaan?',
      description: 'Pelanggan tidak bisa membuat pesanan baru sampai mode ini dimatikan. Tiket yang sudah dibeli tetap bisa diakses.',
      confirmLabel: 'Aktifkan',
      danger: true
    })
    if (!ok) return
  }
  settingsSaving.value = true
  try {
    const body = {
      defaultMaxTicketsPerOrder: s.defaultMaxTicketsPerOrder,
      pendingOrderExpiryMinutes: s.pendingOrderExpiryMinutes,
      supportEmail: s.supportEmail.trim(),
      supportWhatsapp: s.supportWhatsapp.trim(),
      maintenanceMode: s.maintenanceMode
    }
    settings.value = (await request<{ data: SystemSettings }>('/settings/system', { method: 'PATCH', body })).data
    savedMaintenance.value = settings.value.maintenanceMode
    toast.add({ title: 'Pengaturan platform disimpan', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Pengaturan gagal disimpan', description: apiErrorMessage(err), color: 'error' })
  } finally {
    settingsSaving.value = false
  }
}

// Audit log
const auditMethod = ref('all')
const audit = usePaginatedList<AuditLog>('/settings/audit-logs', {
  searchParam: 'search',
  immediate: false,
  query: () => ({ method: auditMethod.value === 'all' ? undefined : auditMethod.value })
})
const auditColumns: TableColumn<AuditLog>[] = [
  { accessorKey: 'createdAt', header: 'Waktu' },
  { accessorKey: 'userEmail', header: 'Pengguna' },
  { accessorKey: 'path', header: 'Aksi' },
  { accessorKey: 'statusCode', header: 'Hasil' },
  { accessorKey: 'ip', header: 'IP' }
]
const methodColor = (m: string) => (m === 'DELETE' ? 'error' : m === 'POST' ? 'success' : 'info')

// Diagnostics
const diag = ref<Diagnostics | null>(null)
const diagLoading = ref(false)
async function loadDiag() {
  diagLoading.value = true
  try {
    diag.value = (await request<{ data: Diagnostics }>('/settings/diagnostics')).data
  } catch {
    diag.value = null
  } finally {
    diagLoading.value = false
  }
}
function uptime(s: number) {
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  return [d && `${d} hari`, h && `${h} jam`, `${m} menit`].filter(Boolean).join(' ')
}
const healthy = (status: string) => ['healthy', 'configured', 'ok', 'connected'].includes(status)

watch(tab, (t) => {
  if (t === 'platform' && !settings.value) loadSettings()
  if (t === 'audit') audit.refresh()
  if (t === 'status') loadDiag()
}, { immediate: true })
</script>

<template>
  <UDashboardPanel id="settings">
    <template #header>
      <UDashboardNavbar title="Pengaturan">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>
      <UDashboardToolbar>
        <UTabs
          v-model="tab"
          :items="tabs"
          :content="false"
          variant="link"
          size="sm"
        />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div
        class="w-full max-w-3xl"
        :class="{ 'max-w-none': tab === 'audit' }"
      >
        <!-- Profile -->
        <div
          v-if="tab === 'profile'"
          class="space-y-4"
        >
          <UCard>
            <template #header>
              <p class="font-medium text-highlighted">
                Profil
              </p>
              <p class="text-xs text-muted">
                Nama dan email yang tampil di log audit.
              </p>
            </template>
            <form
              class="grid sm:grid-cols-2 gap-4"
              @submit.prevent="saveProfile"
            >
              <UFormField label="Nama">
                <UInput
                  v-model="profile.name"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Email">
                <UInput
                  v-model="profile.email"
                  type="email"
                  class="w-full"
                />
              </UFormField>
              <div class="sm:col-span-2 flex items-center justify-between">
                <UBadge
                  :label="user ? ROLE_LABELS[user.role] : ''"
                  color="neutral"
                  variant="subtle"
                />
                <UButton
                  type="submit"
                  label="Simpan profil"
                  :loading="profileSaving"
                />
              </div>
            </form>
          </UCard>

          <UCard>
            <template #header>
              <p class="font-medium text-highlighted">
                Kata sandi
              </p>
              <p class="text-xs text-muted">
                Mengganti kata sandi akan mengeluarkan Anda dari semua perangkat.
              </p>
            </template>
            <form
              class="space-y-4"
              @submit.prevent="changePassword"
            >
              <UFormField label="Kata sandi saat ini">
                <UInput
                  v-model="pw.currentPassword"
                  type="password"
                  autocomplete="current-password"
                  class="w-full"
                />
              </UFormField>
              <div class="grid sm:grid-cols-2 gap-4">
                <UFormField
                  label="Kata sandi baru"
                  help="Min. 8 karakter"
                >
                  <UInput
                    v-model="pw.newPassword"
                    type="password"
                    autocomplete="new-password"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Ulangi kata sandi baru"
                  :error="pwError || undefined"
                >
                  <UInput
                    v-model="pw.confirmNewPassword"
                    type="password"
                    autocomplete="new-password"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div class="flex justify-end">
                <UButton
                  type="submit"
                  label="Ganti kata sandi"
                  :loading="pwSaving"
                  :disabled="!pw.currentPassword || !pw.newPassword || !pw.confirmNewPassword || !!pwError"
                />
              </div>
            </form>
          </UCard>
        </div>

        <!-- Scanner -->
        <UCard v-else-if="tab === 'scanner'">
          <template #header>
            <p class="font-medium text-highlighted">
              Preferensi scanner
            </p>
            <p class="text-xs text-muted">
              Disimpan di perangkat ini dan langsung dipakai halaman Scan Check-In.
            </p>
          </template>
          <div class="space-y-5">
            <USwitch
              v-model="prefs.soundEnabled"
              label="Bunyi umpan balik"
              description="Nada berbeda untuk tiket valid, sudah dipakai, dan tidak valid."
            />
            <UFormField
              label="Volume"
              :hint="`${prefs.soundVolume}%`"
            >
              <div class="flex items-center gap-3">
                <USlider
                  v-model="prefs.soundVolume"
                  :min="0"
                  :max="100"
                  :disabled="!prefs.soundEnabled"
                  class="flex-1"
                />
                <UButton
                  label="Tes"
                  icon="i-lucide-volume-2"
                  color="neutral"
                  variant="outline"
                  :disabled="!prefs.soundEnabled"
                  @click="playTone('success', prefs.soundVolume)"
                />
              </div>
            </UFormField>
            <USwitch
              v-model="prefs.continuousMode"
              label="Mode berkelanjutan"
              description="Kamera tetap aktif setelah setiap scan. Matikan untuk berhenti setelah satu tiket."
            />
            <UFormField label="Kamera default">
              <USelect
                v-model="prefs.cameraFacing"
                :items="[{ label: 'Kamera belakang', value: 'environment' }, { label: 'Kamera depan', value: 'user' }]"
                class="w-56"
              />
            </UFormField>
            <div class="flex justify-end">
              <UButton
                label="Simpan preferensi"
                @click="storePrefs"
              />
            </div>
          </div>
        </UCard>

        <!-- Platform -->
        <template v-else-if="tab === 'platform'">
          <UAlert
            v-if="settingsError"
            color="error"
            variant="subtle"
            :title="settingsError"
            :actions="[{ label: 'Coba lagi', onClick: loadSettings }]"
          />
          <USkeleton
            v-else-if="!settings"
            class="h-80 w-full"
          />
          <UCard v-else>
            <template #header>
              <p class="font-medium text-highlighted">
                Konfigurasi platform
              </p>
              <p class="text-xs text-muted">
                Berlaku untuk seluruh pelanggan di aplikasi.
              </p>
            </template>
            <form
              class="space-y-5"
              @submit.prevent="saveSettings"
            >
              <div class="grid sm:grid-cols-2 gap-4">
                <UFormField
                  label="Default maks. tiket per pesanan"
                  help="1–10"
                >
                  <UInputNumber
                    v-model="settings.defaultMaxTicketsPerOrder"
                    :min="1"
                    :max="10"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Batas waktu pembayaran (menit)"
                  help="5–120"
                >
                  <UInputNumber
                    v-model="settings.pendingOrderExpiryMinutes"
                    :min="5"
                    :max="120"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Email dukungan">
                  <UInput
                    v-model="settings.supportEmail"
                    type="email"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="WhatsApp dukungan">
                  <UInput
                    v-model="settings.supportWhatsapp"
                    placeholder="+62…"
                    class="w-full"
                  />
                </UFormField>
              </div>
              <div
                class="rounded-lg border p-4"
                :class="settings.maintenanceMode ? 'border-warning/50 bg-warning/5' : 'border-default'"
              >
                <USwitch
                  v-model="settings.maintenanceMode"
                  color="warning"
                  label="Mode pemeliharaan"
                  description="Menutup pembuatan pesanan baru di aplikasi pelanggan."
                />
              </div>
              <div class="flex justify-end">
                <UButton
                  type="submit"
                  label="Simpan konfigurasi"
                  :loading="settingsSaving"
                />
              </div>
            </form>
          </UCard>
        </template>

        <!-- Audit -->
        <div
          v-else-if="tab === 'audit'"
          class="space-y-3"
        >
          <div class="flex flex-wrap gap-2">
            <UInput
              v-model="audit.search.value"
              icon="i-lucide-search"
              placeholder="Cari path atau pengguna…"
              class="w-72"
            />
            <USelect
              v-model="auditMethod"
              :items="[{ label: 'Semua aksi', value: 'all' }, 'POST', 'PUT', 'PATCH', 'DELETE']"
              class="w-36"
            />
          </div>
          <UAlert
            v-if="audit.error.value"
            color="error"
            variant="subtle"
            :title="audit.error.value"
          />
          <UCard :ui="{ body: 'p-0 sm:p-0' }">
            <UTable
              :data="audit.items.value"
              :columns="auditColumns"
              :loading="audit.loading.value"
              :ui="{ th: 'text-xs font-medium text-muted', td: 'py-2.5 text-xs' }"
            >
              <template #createdAt-cell="{ row }">
                <span class="whitespace-nowrap text-muted">{{ formatDateTime(row.original.createdAt) }}</span>
              </template>
              <template #userEmail-cell="{ row }">
                <p class="text-highlighted">
                  {{ row.original.userName ?? row.original.userEmail ?? '—' }}
                </p>
                <p class="text-muted">
                  {{ row.original.userRole }}
                </p>
              </template>
              <template #path-cell="{ row }">
                <div class="flex items-center gap-2">
                  <UBadge
                    :label="row.original.method"
                    :color="methodColor(row.original.method)"
                    variant="subtle"
                    size="sm"
                    class="font-mono"
                  />
                  <span class="font-mono truncate max-w-80">{{ row.original.path }}</span>
                </div>
              </template>
              <template #statusCode-cell="{ row }">
                <UBadge
                  :label="String(row.original.statusCode)"
                  :color="row.original.statusCode < 400 ? 'success' : row.original.statusCode < 500 ? 'warning' : 'error'"
                  variant="soft"
                  size="sm"
                />
                <span
                  v-if="row.original.durationMs !== null"
                  class="ml-1.5 text-dimmed"
                >{{ row.original.durationMs }} ms</span>
              </template>
              <template #ip-cell="{ row }">
                <span class="font-mono text-muted">{{ row.original.ip }}</span>
              </template>
              <template #empty>
                <div
                  v-if="audit.loading.value"
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
                  icon="i-lucide-scroll-text"
                  title="Belum ada aktivitas tercatat"
                  description="Setiap perubahan oleh admin akan tercatat di sini."
                  variant="naked"
                />
              </template>
            </UTable>
          </UCard>
          <div
            v-if="audit.totalPages.value > 1"
            class="flex justify-end"
          >
            <UPagination
              v-model:page="audit.page.value"
              :total="audit.totalCount.value"
              :items-per-page="audit.limit"
            />
          </div>
        </div>

        <!-- Status -->
        <div
          v-else-if="tab === 'status'"
          class="space-y-3"
        >
          <div class="flex justify-end">
            <UButton
              icon="i-lucide-refresh-cw"
              label="Periksa ulang"
              color="neutral"
              variant="outline"
              :loading="diagLoading"
              @click="loadDiag"
            />
          </div>
          <div
            v-if="diag"
            class="grid sm:grid-cols-2 gap-3"
          >
            <UCard
              v-for="item in [
                { label: 'Database', icon: 'i-lucide-database', status: diag.database.status, detail: `Latensi ${diag.database.latencyMs} ms` },
                { label: 'Penyimpanan gambar', icon: 'i-lucide-hard-drive', status: diag.storage.status, detail: diag.storage.provider },
                { label: 'Payment gateway', icon: 'i-lucide-credit-card', status: diag.paymentGateway.status, detail: diag.paymentGateway.environment },
                { label: 'Server', icon: 'i-lucide-server', status: 'healthy', detail: `${diag.runtime.nodeEnv} · aktif ${uptime(diag.runtime.uptimeSeconds)}` }
              ]"
              :key="item.label"
            >
              <div class="flex items-center gap-3">
                <UIcon
                  :name="item.icon"
                  class="size-5 text-muted"
                />
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-highlighted">
                    {{ item.label }}
                  </p>
                  <p class="text-xs text-muted truncate">
                    {{ item.detail }}
                  </p>
                </div>
                <UBadge
                  :label="item.status"
                  :color="healthy(item.status) ? 'success' : 'error'"
                  variant="subtle"
                />
              </div>
            </UCard>
          </div>
          <UAlert
            v-else-if="!diagLoading"
            color="error"
            variant="subtle"
            title="Status sistem gagal dimuat."
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
