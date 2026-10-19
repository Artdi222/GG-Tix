import { describe, expect, it } from 'vitest'
import { formatDate, formatIDR, formatNumber, fromDatetimeLocal, toDateInput, toDatetimeLocal } from '~/utils/format'

// Intl uses a narrow no-break space between "Rp" and the amount.
const plain = (s: string) => s.replace(/\s/g, ' ')

describe('formatIDR', () => {
  it.each([
    [750000, 'Rp 750.000'],
    ['750000.00', 'Rp 750.000'],
    [0, 'Rp 0'],
    [null, 'Rp 0'],
    [undefined, 'Rp 0'],
    ['abc', 'Rp 0'],
    [Number.NaN, 'Rp 0'],
    [-25000, '-Rp 25.000']
  ])('%p -> %s', (input, expected) => {
    expect(plain(formatIDR(input as never))).toBe(expected)
  })

  it('compact notation for axis labels', () => {
    expect(plain(formatIDR(15_000_000, true))).toBe('Rp 15 jt')
  })
})

describe('formatNumber / formatDate', () => {
  it('groups thousands the Indonesian way', () => {
    expect(formatNumber(1234567)).toBe('1.234.567')
    expect(formatNumber(null)).toBe('0')
  })

  it('renders an em dash for missing or invalid dates', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('not a date')).toBe('—')
  })
})

describe('datetime-local round trip', () => {
  it('shows the WIB wall-clock time, not UTC', () => {
    expect(toDatetimeLocal('2026-11-08T11:30:00.000Z')).toBe('2026-11-08T18:30')
  })

  it('is lossless: editing and saving without changes keeps the instant', () => {
    const iso = '2026-11-08T11:30:00.000Z'
    expect(fromDatetimeLocal(toDatetimeLocal(iso))).toBe(iso)
  })

  it('handles the day boundary in local time', () => {
    expect(toDateInput(new Date('2026-10-18T18:00:00.000Z'))).toBe('2026-10-19')
  })

  it('returns empty/null for empty or invalid input', () => {
    expect(toDatetimeLocal(null)).toBe('')
    expect(fromDatetimeLocal('')).toBeNull()
    expect(fromDatetimeLocal('garbage')).toBeNull()
  })
})
