import { randomUUID } from "node:crypto";
import { AppError } from "../lib/errors";
import { processImage, parseKind, objectKeysFor, UploadKind } from "../lib/image";
import { uploadObject, IMAGE_MAX_BYTES } from "../lib/storage";

export interface UploadResult {
  url: string;
  thumbUrl: string;
  key: string;
}

// UPL-02/UPL-03: accept raw file (multipart), crop to kind ratio, WebP,
// upload main+thumb to B2, return permanent public URLs.
export async function uploadImage(
  file: File | null,
  kindValue: string | null | undefined
): Promise<UploadResult> {
  if (!file) {
    throw new AppError("File gambar wajib dikirim.", 400);
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new AppError("Ukuran gambar maksimal 10 MB.", 413 as any);
  }

  const kind: UploadKind = parseKind(kindValue);
  const buffer = Buffer.from(await file.arrayBuffer());
  const { mainBuffer, thumbBuffer } = await processImage(buffer, kind);
  const uuid = randomUUID();
  const year = new Date().getUTCFullYear();
  const { mainKey, thumbKey } = objectKeysFor(uuid, year);

  const [url, thumbUrl] = await Promise.all([
    uploadObject(mainKey, mainBuffer, "image/webp"),
    uploadObject(thumbKey, thumbBuffer, "image/webp"),
  ]);

  return { url, thumbUrl, key: mainKey };
}