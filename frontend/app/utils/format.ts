const idr = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
const idrCompact = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', notation: 'compact', maximumFractionDigits: 1 })
const num = new Intl.NumberFormat('id-ID')

/** Accepts API decimals ("750000.00") and numbers; invalid input renders as Rp 0. */
export function formatIDR(value: string | number | null | undefined, compact = false) {
  const n = typeof value === 'number' ? value : Number.parseFloat(value ?? '')
  return (compact ? idrCompact : idr).format(Number.isFinite(n) ? n : 0)
}

export function formatNumber(value: number | null | undefined) {
  return num.format(value ?? 0)
}

function toDate(value: string | Date | null | undefined) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value: string | Date | null | undefined) {
  const d = toDate(value)
  return d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

/** Pass the venue's IANA zone to show an event in its local time; omit for the browser's zone. */
export function formatDateTime(value: string | Date | null | undefined, timeZone?: string) {
  const d = toDate(value)
  return d
    ? d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone })
    : '—'
}

/** Wall-clock parts of `d` in `timeZone`. */
function zonedParts(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') }
}

export function formatTime(value: string | Date | null | undefined) {
  const d = toDate(value)
  return d ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
}

/**
 * ISO timestamp -> value for <input type="datetime-local"> in the browser's timezone.
 * (toISOString().slice(0, 16) would show UTC and shift the time on every save.)
 */
export function toDatetimeLocal(value: string | Date | null | undefined, timeZone?: string) {
  const d = toDate(value)
  if (!d) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  if (timeZone) {
    const p = zonedParts(d, timeZone)
    return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value (local time) -> ISO timestamp, or null when empty/invalid. */
export function fromDatetimeLocal(value: string | null | undefined, timeZone?: string) {
  if (timeZone && value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    // Read the wall-clock time as if UTC, then subtract the zone's offset at that instant.
    // Two passes settle the offset across a DST change.
    const wall = Date.UTC(+value.slice(0, 4), +value.slice(5, 7) - 1, +value.slice(8, 10), +value.slice(11, 13), +value.slice(14, 16))
    let ts = wall
    for (let i = 0; i < 2; i++) {
      const p = zonedParts(new Date(ts), timeZone)
      ts = wall - (Date.UTC(p.y, p.m - 1, p.d, p.h, p.min) - ts)
    }
    return new Date(ts).toISOString()
  }
  const d = toDate(value)
  return d ? d.toISOString() : null
}

/** "YYYY-MM-DD" in local time, for <input type="date">. */
export function toDateInput(value: Date) {
  return toDatetimeLocal(value).slice(0, 10)
}
