<script setup lang="ts">
import * as v from 'valibot'
import type { FormSubmitEvent } from '@nuxt/ui'

definePageMeta({ layout: false })

const { login } = useAuth()

const schema = v.object({
  email: v.pipe(v.string(), v.email('Format email tidak valid')),
  password: v.pipe(v.string(), v.minLength(6, 'Password minimal 6 karakter'))
})
type Schema = v.InferOutput<typeof schema>

const state = reactive({
  email: '',
  password: ''
})

const showPassword = ref(false)
const isLoading = ref(false)
const loginError = ref('')

async function onSubmit(event: FormSubmitEvent<Schema>) {
  isLoading.value = true
  loginError.value = ''
  try {
    const user = await login(event.data.email, event.data.password)
    if (user?.role === 'gate_staff') {
      await navigateTo('/scanner')
    } else {
      await navigateTo('/')
    }
  } catch (err: any) {
    loginError.value = err.data?.error || err.message || 'Email atau password salah'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex bg-white">
    <!-- Left panel: brand identity -->
    <div class="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-[#1B1330] text-white flex-col justify-between px-12 py-14">

      <div class="relative z-10">
        <span class="text-xl font-bold tracking-[0.3em]">GGTIX</span>
      </div>

      <div class="relative z-10 space-y-5 max-w-xs">
        <p class="text-xs uppercase tracking-[0.35em] text-[#F2A93B]">Admin console</p>
        <h1 class="text-4xl font-bold leading-tight">
          Manage every<br>show from<br>one stage.
        </h1>
        <p class="text-white/60 text-sm">
          Manage events, tickets, and orders for every concert you run.
        </p>
      </div>

      <p class="relative z-10 text-xs text-white/40">© 2026 GGTIX</p>
    </div>

    <!-- Ticket-tear divider -->
    <div class="hidden lg:block w-px relative" aria-hidden="true">
      <div
        class="absolute inset-y-0 -left-3 w-6"
        style="background-image: radial-gradient(circle, white 0 5px, transparent 5px); background-size: 24px 24px; background-repeat: repeat-y; background-position: center;"
      />
    </div>

    <!-- Right panel: login form -->
    <div class="flex-1 flex items-center justify-center px-6 py-14">
      <div class="w-full max-w-sm">
        <div class="lg:hidden mb-10 text-center">
          <span class="text-lg font-bold tracking-[0.3em] text-[#1B1330]">GGTIX</span>
        </div>

        <h2 class="text-2xl font-medium text-gray-900">Sign in to admin panel</h2>
        <p class="mt-1 text-sm text-gray-500">Enter your credentials to continue.</p>

        <UAlert
          v-if="loginError"
          class="mt-6"
          color="error"
          variant="soft"
          :title="loginError"
        />

        <UForm :schema="schema" :state="state" class="mt-8 space-y-5" @submit="onSubmit">
          <UFormField label="Email" name="email">
            <UInput
              v-model="state.email"
              type="email"
              placeholder="name@ggtix.com"
              icon="i-lucide-mail"
              size="lg"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Password" name="password">
            <UInput
              v-model="state.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="••••••••"
              icon="i-lucide-lock"
              size="lg"
              class="w-full"
            >
              <template #trailing>
                <UButton
                  color="neutral"
                  variant="link"
                  size="sm"
                  :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                  @click="showPassword = !showPassword"
                />
              </template>
            </UInput>
          </UFormField>

          <UButton
            type="submit"
            block
            size="lg"
            :loading="isLoading"
            class="bg-[#1B1330] hover:bg-[#2A1F49] text-white mt-5"
          >
            Sign in
          </UButton>
        </UForm>
      </div>
    </div>
  </div>
</template>