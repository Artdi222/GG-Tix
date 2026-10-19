export interface ScannerPrefs {
  soundEnabled: boolean
  /** 0–100 */
  soundVolume: number
  /** Keep the camera running after each scan; off = stop after one result. */
  continuousMode: boolean
  cameraFacing: 'environment' | 'user'
}

const KEY = 'ggtix_scanner_prefs'
const DEFAULTS: ScannerPrefs = { soundEnabled: true, soundVolume: 80, continuousMode: true, cameraFacing: 'environment' }

/** Device-local scanner preferences, shared by the settings page and the scanner. */
export function useScannerPrefs() {
  const prefs = useState<ScannerPrefs>('scanner_prefs', () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<ScannerPrefs> | null
      return { ...DEFAULTS, ...saved, soundVolume: Number(saved?.soundVolume ?? DEFAULTS.soundVolume) }
    } catch {
      return { ...DEFAULTS }
    }
  })

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs.value))
      return true
    } catch {
      return false
    }
  }

  return { prefs, save }
}

let audio: AudioContext | null = null

/** Short feedback tone. Reuses one AudioContext; browsers cap how many can exist. */
export function playTone(kind: 'success' | 'warning' | 'error', volume: number) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audio ??= new Ctx()
    if (audio.state === 'suspended') void audio.resume()
    const now = audio.currentTime
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    const peak = Math.max(0.0001, (volume / 100) * 0.4)
    if (kind === 'success') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.15)
    } else {
      osc.type = kind === 'warning' ? 'triangle' : 'sawtooth'
      osc.frequency.setValueAtTime(kind === 'warning' ? 440 : 160, now)
    }
    gain.gain.setValueAtTime(peak, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35)
    osc.connect(gain).connect(audio.destination)
    osc.start(now)
    osc.stop(now + 0.35)
  } catch {
    // Autoplay restrictions: silent is acceptable.
  }
}
