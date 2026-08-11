import sharp from "sharp";
import { AppError } from "./errors";

export type UploadKind = "profile" | "banner" | "venue";

const KIND_CONFIG: Record<UploadKind, { width: number; height: number }> = {
  profile: { width: 800, height: 800 },
  banner: { width: 1600, height: 900 },
  venue: { width: 900, height: 1600 },
};

export function parseKind(formValue: string | null | undefined): UploadKind {
  if (!formValue || formValue === "") return "profile";
  const k = formValue as UploadKind;
  if (k in KIND_CONFIG) return k;
  throw new AppError("Jenis gambar tidak diketahui.", 400);
}

export interface ProcessedImage {
  mainBuffer: Buffer; // crop + resize + WebP 85%
  thumbBuffer: Buffer; // 400x400 WebP 80%
}

// Validate magic bytes + format via `sharp` metadata internals.
export async function processImage(
  buffer: Buffer,
  kind: UploadKind
): Promise<ProcessedImage> {
  const cfg = KIND_CONFIG[kind];
  try {
    const meta = await sharp(buffer).metadata();
    if (meta.format !== "png" && meta.format !== "jpeg" && meta.format !== "webp") {
      throw new AppError("File harus berupa gambar (PNG, JPG, atau WebP).", 400);
    }

    const mainBuffer = await sharp(buffer)
      .resize(cfg.width, cfg.height, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 85 })
      .toBuffer();

    const thumbBuffer = await sharp(buffer)
      .resize(400, 400, {
        fit: "cover",
        position: "centre",
      })
      .webp({ quality: 80 })
      .toBuffer();

    return { mainBuffer, thumbBuffer };
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError("File harus berupa gambar (PNG, JPG, atau WebP).", 400);
  }
}

export function objectKeysFor(
  uuid: string,
  year: number
): { mainKey: string; thumbKey: string } {
  const base = `uploads/${year}/${uuid}`;
  return { mainKey: `${base}.webp`, thumbKey: `${base}_thumb.webp` };
}