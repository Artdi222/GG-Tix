import { z } from "zod";

// Query-string pagination that never yields NaN: garbage input falls back to defaults.
export const pageQuery = () =>
  z.string().optional().transform((v) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) && n >= 1 ? n : 1;
  });

export const limitQuery = (defaultLimit: number, max = 100) =>
  z.string().optional().transform((v) => {
    const n = parseInt(v ?? "", 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(1, n)) : defaultLimit;
  });
