<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Masuk' })

const { login } = useAuth()
const route = useRoute()

const state = reactive({ email: '', password: '' })
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  if (!/^\S+@\S+\.\S+$/.test(state.email.trim())) {
    error.value = 'Masukkan email yang valid.'
    return
  }
  if (!state.password) {
    error.value = 'Masukkan kata sandi.'
    return
  }
  loading.value = true
  try {
    const user = await login(state.email.trim(), state.password)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : null
    await navigateTo(user.role === 'gate_staff' ? '/scanner' : redirect ?? '/')
  } catch (err) {
    const status = apiErrorStatus(err)
    error.value = status === 401
      ? 'Email atau kata sandi salah.'
      : apiErrorMessage(err, 'Tidak dapat masuk. Coba lagi.')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-dvh grid lg:grid-cols-2 bg-default">
    <aside class="hidden lg:flex flex-col justify-between bg-brand-950 text-white p-12">
      <div class="flex items-center gap-2.5">
        <span class="size-9 rounded-lg bg-white/10 text-accent grid place-items-center">
          <UIcon
            name="i-lucide-ticket"
            class="size-5"
          />
        </span>
        <span class="font-semibold tracking-wide">GGTIX</span>
      </div>
      <div class="max-w-sm space-y-4">
        <h1 class="text-3xl font-semibold leading-tight text-balance">
          Kelola setiap pertunjukan dari satu tempat.
        </h1>
        <p class="text-white/60">
          Event, penjualan tiket, voucher, dan check-in di gerbang — dalam satu konsol.
        </p>
      </div>
      <p class="text-xs text-white/40">
        © {{ new Date().getFullYear() }} GGTIX
      </p>
    </aside>

    <main class="flex items-center justify-center p-6">
      <div class="w-full max-w-sm space-y-6">
        <div class="space-y-1">
          <div class="lg:hidden mb-6 flex items-center gap-2.5">
            <span class="size-9 rounded-lg bg-brand-950 text-accent grid place-items-center">
              <UIcon
                name="i-lucide-ticket"
                class="size-5"
              />
            </span>
            <span class="font-semibold tracking-wide text-highlighted">GGTIX</span>
          </div>
          <h2 class="text-2xl font-semibold text-highlighted">
            Masuk ke konsol admin
          </h2>
          <p class="text-sm text-muted">
            Gunakan akun yang diberikan oleh Super Admin.
          </p>
        </div>

        <form
          class="space-y-4"
          novalidate
          @submit.prevent="submit"
        >
          <UFormField label="Email">
            <UInput
              v-model="state.email"
              type="email"
              autocomplete="username"
              placeholder="nama@ggtix.com"
              size="lg"
              class="w-full"
              autofocus
            />
          </UFormField>
          <UFormField label="Kata sandi">
            <UInput
              v-model="state.password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              size="lg"
              class="w-full"
              :ui="{ trailing: 'pe-1' }"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'"
                  :aria-pressed="showPassword"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UAlert
            v-if="error"
            color="error"
            variant="subtle"
            icon="i-lucide-circle-alert"
            :title="error"
          />

          <UButton
            type="submit"
            label="Masuk"
            size="lg"
            block
            :loading="loading"
          />
        </form>
      </div>
    </main>
  </div>
</template>
