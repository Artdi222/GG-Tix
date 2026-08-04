// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devServer: { port: 3001 },
  colorMode: {
    preference: 'light',
    fallback: 'light'
  },

  app:{
    head: {
      meta: [
        {name: 'color-scheme', content: 'light'}
      ]
    }
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    '/': { prerender: true }
  },

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
