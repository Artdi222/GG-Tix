// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  // Auth-gated admin console: render client-side only. Avoids SSR/client
  // hydration mismatches on locale- and timezone-dependent values.
  ssr: false,

  devtools: {
    enabled: true
  },

  app: {
    head: {
      meta: [
        { name: 'color-scheme', content: 'light' }
      ]
    }
  },

  css: ['~/assets/css/main.css'],

  colorMode: {
    preference: 'light',
    fallback: 'light'
  },

  // Override with NUXT_PUBLIC_API_BASE in each environment.
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3000/api'
    }
  },

  devServer: { port: 3001 },

  compatibilityDate: '2026-06-30',

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
