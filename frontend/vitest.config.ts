import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    include: ['test/**/*.test.ts'],
    // Dates are asserted in WIB, the timezone the admins work in.
    env: { TZ: 'Asia/Jakarta' }
  }
})
