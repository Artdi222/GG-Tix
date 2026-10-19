import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import StatusBadge from '~/components/StatusBadge.vue'
import StatCard from '~/components/StatCard.vue'
import EventCover from '~/components/EventCover.vue'
import TrendChart from '~/components/TrendChart.vue'

describe('StatusBadge', () => {
  it.each([
    ['verified', 'Lunas'],
    ['pending', 'Menunggu'],
    ['expired', 'Kedaluwarsa'],
    ['scheduled', 'Terjadwal']
  ])('%s -> %s', async (status, label) => {
    const w = await mountSuspended(StatusBadge, { props: { status } })
    expect(w.text()).toBe(label)
  })

  it('falls back to the raw status for unknown values', async () => {
    const w = await mountSuspended(StatusBadge, { props: { status: 'mystery' } })
    expect(w.text()).toBe('mystery')
  })
})

describe('StatCard', () => {
  const base = { label: 'Pendapatan', value: 'Rp 1.000', icon: 'i-lucide-wallet' }

  it('shows a positive delta as good', async () => {
    const w = await mountSuspended(StatCard, { props: { ...base, delta: 12.34 } })
    expect(w.text()).toContain('+12,3%')
    expect(w.html()).toContain('text-success')
  })

  it('inverts the colour when lower is better', async () => {
    const w = await mountSuspended(StatCard, { props: { ...base, delta: -5, invertDelta: true } })
    expect(w.text()).toContain('-5%')
    expect(w.html()).toContain('text-success')
  })

  it('hides the chip without a baseline', async () => {
    for (const delta of [null, undefined, Number.POSITIVE_INFINITY, Number.NaN]) {
      const w = await mountSuspended(StatCard, { props: { ...base, delta } })
      expect(w.text()).not.toContain('%')
    }
  })

  it('shows a skeleton instead of the value while loading', async () => {
    const w = await mountSuspended(StatCard, { props: { ...base, loading: true } })
    expect(w.text()).not.toContain('Rp 1.000')
  })
})

describe('EventCover', () => {
  it('derives initials from the title and ignores punctuation', async () => {
    const w = await mountSuspended(EventCover, { props: { title: 'Honkai: Star Rail — Astral Concert' } })
    expect(w.text()).toBe('HS')
  })

  it('uses the same gradient for the same title', async () => {
    const a = await mountSuspended(EventCover, { props: { title: 'Genshin Impact' } })
    const b = await mountSuspended(EventCover, { props: { title: 'Genshin Impact' } })
    expect(a.html()).toBe(b.html())
  })

  it('falls back to the gradient when the image fails to load', async () => {
    const w = await mountSuspended(EventCover, { props: { title: 'Zenless Zone Zero', src: 'https://example.invalid/x.png' } })
    expect(w.find('img').exists()).toBe(true)
    await w.find('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toBe('ZZ')
  })
})

describe('TrendChart', () => {
  const props = { label: 'Pendapatan', format: (v: number) => String(v) }

  it('shows an empty state when every value is zero', async () => {
    const points = [{ date: '2026-10-01', value: 0 }, { date: '2026-10-02', value: 0 }]
    const w = await mountSuspended(TrendChart, { props: { ...props, points } })
    expect(w.text()).toContain('Belum ada penjualan pada periode ini')
  })

  it('draws the series and the comparison line', async () => {
    const points = [1, 5, 3].map((value, i) => ({ date: `2026-10-0${i + 1}`, value }))
    const compare = [2, 2, 2].map((value, i) => ({ date: `2026-09-0${i + 1}`, value }))
    const w = await mountSuspended(TrendChart, { props: { ...props, points, compare } })
    expect(w.findAll('path[stroke-dasharray]').length).toBe(1)
    expect(w.text()).not.toContain('Belum ada penjualan')
  })

  it('never produces NaN coordinates for a single point', async () => {
    const w = await mountSuspended(TrendChart, { props: { ...props, points: [{ date: '2026-10-01', value: 10 }] } })
    expect(w.html()).not.toContain('NaN')
  })
})
