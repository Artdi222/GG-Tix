import { expect, test, type Page } from '@playwright/test'

const PASSWORD = 'admin123'

async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Kata sandi', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Masuk' }).click()
}

/** Signs in and waits until the session is stored, so the next navigation keeps it. */
async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto('/login')
  await submitLogin(page, email, password)
  await page.waitForURL(url => !url.pathname.startsWith('/login'))
}

test.describe('authentication', () => {
  test('wrong password shows an error and stays on login', async ({ page }) => {
    await page.goto('/login')
    await submitLogin(page, 'budi@ggtix.com', 'wrong-password')
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('super admin lands on the overview with live data', async ({ page }) => {
    await login(page, 'budi@ggtix.com')
    await expect(page.getByRole('heading', { name: /Selamat (pagi|siang|sore|malam), Budi/ })).toBeVisible()
    await expect(page.getByText('Pendapatan').first()).toBeVisible()
  })

  test('deep link redirects to login and back after signing in', async ({ page }) => {
    await page.goto('/vouchers')
    await expect(page).toHaveURL(/\/login\?redirect=(%2F|\/)vouchers/)
    await submitLogin(page, 'budi@ggtix.com', PASSWORD)
    await expect(page).toHaveURL(/\/vouchers$/)
  })

  test('logout clears the session', async ({ page }) => {
    await login(page, 'budi@ggtix.com')
    await page.getByRole('button', { name: /Budi Santoso/ }).click()
    await page.getByRole('menuitem', { name: 'Keluar' }).click()
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/orders')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('role gates', () => {
  test('gate staff only gets the scanner', async ({ page }) => {
    await login(page, 'siti@ggtix.com')
    await expect(page).toHaveURL(/\/scanner/)
    await page.goto('/orders')
    await expect(page).toHaveURL(/\/scanner/)
    await expect(page.getByRole('link', { name: 'Pesanan' })).toHaveCount(0)
  })

  test('admin only gets personal settings, not platform settings or the admin list', async ({ page }) => {
    await login(page, 'maya@ggtix.com')
    await expect(page.getByRole('link', { name: 'Pengaturan' })).toHaveCount(0)
    await page.goto('/settings?tab=audit')
    await expect(page.getByRole('tab', { name: 'Profil & keamanan' })).toBeVisible()
    for (const tab of ['Platform', 'Log audit', 'Status sistem']) {
      await expect(page.getByRole('tab', { name: tab })).toHaveCount(0)
    }
    await page.goto('/users?tab=admins')
    await expect(page.getByRole('tab', { name: 'Admin & staf' })).toHaveCount(0)
  })
})

test.describe('orders', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'budi@ggtix.com')
    await page.goto('/orders')
    await expect(page.getByText(/^1–10 dari \d+/)).toBeVisible()
  })

  test('paginates 10 rows at a time', async ({ page }) => {
    await expect(page.locator('tbody tr')).toHaveCount(10)
    await page.getByRole('button', { name: 'Page 2' }).click()
    await expect(page.getByText(/^11–20 dari \d+/)).toBeVisible()
  })

  test('status filter narrows the list', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Filter status' }).click()
    await page.getByRole('option', { name: 'Ditolak' }).click()
    await expect(page.locator('tbody tr').first()).toContainText('Ditolak')
    for (const row of await page.locator('tbody tr').all()) await expect(row).toContainText('Ditolak')
  })

  test('search with LIKE wildcards matches literally', async ({ page }) => {
    await page.getByPlaceholder(/Cari ID/).fill('%')
    await expect(page.getByText(/Tidak ada pesanan/)).toBeVisible()
  })

  test('search finds a customer by name', async ({ page }) => {
    const name = (await page.locator('tbody tr').first().locator('td').nth(1).locator('p').first().innerText()).trim()
    await page.getByPlaceholder(/Cari ID/).fill(name)
    await expect(page.locator('tbody tr').first()).toContainText(name)
  })
})

test.describe('venues CRUD', () => {
  const name = `E2E Hall ${Date.now()}`

  test('create, find, edit and delete a venue', async ({ page }) => {
    await login(page, 'budi@ggtix.com')
    await page.goto('/venues')

    await page.getByRole('button', { name: 'Tambah venue' }).first().click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Nama venue').fill(name)
    await dialog.getByLabel('Alamat').fill('Jl. Pengujian No. 1')
    await dialog.getByLabel('Kota').fill('Depok')
    await dialog.getByRole('button', { name: 'Tambah venue' }).click()
    await expect(dialog).toBeHidden()

    await page.getByLabel('Cari venue').fill(name)
    const row = page.locator('tbody tr', { hasText: name })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Depok')

    await row.getByRole('button', { name: `Edit ${name}` }).click()
    await page.getByRole('dialog').getByLabel('Kota').fill('Bogor')
    await page.getByRole('dialog').getByRole('button', { name: 'Simpan perubahan' }).click()
    await expect(row).toContainText('Bogor')

    await row.getByRole('button', { name: `Hapus ${name}` }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Hapus venue' }).click()
    await expect(page.getByText(/Tidak ada venue yang cocok/)).toBeVisible()
  })

  test('cancelling the delete confirmation keeps the venue', async ({ page }) => {
    await login(page, 'budi@ggtix.com')
    await page.goto('/venues')
    const first = page.locator('tbody tr').first()
    const venue = (await first.locator('p').first().innerText()).trim()
    await first.getByRole('button', { name: /^Hapus / }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Batal' }).click()
    await expect(page.locator('tbody tr', { hasText: venue })).toBeVisible()
  })

  test('deleting a venue that events use shows the server reason', async ({ page }) => {
    await login(page, 'budi@ggtix.com')
    await page.goto('/venues')
    await page.getByLabel('Cari venue').fill('Gelora Bung Karno')
    const row = page.locator('tbody tr', { hasText: 'Gelora Bung Karno' })
    await row.getByRole('button', { name: /^Hapus / }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Hapus venue' }).click()
    await expect(page.getByText('Venue tidak dapat dihapus').first()).toBeVisible()
    await expect(row).toBeVisible()
  })
})

test.describe('vouchers', () => {
  test('client-side validation blocks an empty form', async ({ page }) => {
    await login(page, 'budi@ggtix.com')
    await page.goto('/vouchers')
    await page.getByRole('button', { name: 'Buat voucher' }).first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Buat voucher' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible()
    await expect(page.getByRole('dialog')).toBeVisible()
  })
})

test.describe('events', () => {
  test('list shows covers and sell-through for every event', async ({ page }) => {
    await login(page, 'budi@ggtix.com')
    await page.goto('/events')
    await expect(page.locator('tbody tr')).toHaveCount(10)
    await expect(page.locator('tbody tr').first()).toContainText('%')
  })
})

test('@mobile overview and tables fit a phone screen', async ({ page }) => {
  await login(page, 'budi@ggtix.com')
  await expect(page.getByRole('heading', { name: /Selamat/ })).toBeVisible()
  for (const path of ['/', '/orders', '/events', '/vouchers']) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${path} scrolls horizontally`).toBeLessThanOrEqual(0)
  }
})
