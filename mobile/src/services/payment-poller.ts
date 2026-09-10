import type { PaymentStatus } from './payment';

/** One request at a time, bounded retries, and no updates after leaving the screen. */
export function createPaymentPoller(options: {
  request: (signal: AbortSignal) => Promise<PaymentStatus>;
  onStatus: (status: PaymentStatus) => void;
  onError: (message: string) => void;
  onChecking: (checking: boolean) => void;
  onEnded: () => void;
  intervalMs?: number;
  maxAttempts?: number;
}) {
  let generation = 0;
  let attempts = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;
  let running = false;
  const pause = () => {
    generation++;
    clearTimeout(timer);
    controller?.abort();
    controller = null;
    options.onChecking(false);
  };
  const poll = async (version: number) => {
    if (version !== generation || running) return;
    running = true;
    const current = new AbortController();
    controller = current;
    const timeout = setTimeout(() => current.abort(), 15000);
    options.onChecking(true);
    try {
      const status = await options.request(current.signal);
      if (version !== generation || current.signal.aborted) return;
      options.onStatus(status);
      attempts++;
      if (status.status !== 'pending' || status.requiresReview) return;
      if (attempts >= (options.maxAttempts ?? 15)) { options.onEnded(); return; }
      timer = setTimeout(() => void poll(version), options.intervalMs ?? 4000);
    } catch (error) {
      if (version !== generation) return;
      options.onError(current.signal.aborted ? 'Pemeriksaan terlalu lama. Coba periksa status lagi.' : error instanceof Error ? error.message : 'Status belum dapat diperiksa. Coba lagi.');
      options.onEnded();
    } finally {
      clearTimeout(timeout);
      running = false;
      if (controller === current) controller = null;
      if (version === generation) options.onChecking(false);
    }
  };
  return {
    pause,
    restart() {
      pause();
      attempts = 0;
      const version = generation;
      // Let an aborted request settle before starting another one.
      const begin = () => {
        if (version !== generation) return;
        if (running) { timer = setTimeout(begin, 50); return; }
        void poll(version);
      };
      begin();
    },
  };
}
