import { AppError } from "./errors";
import { createHash } from "node:crypto";

// An unpublished detail: we are calling the B2 Native API via fetch (no AWS SDK).
// Backblaze B2 flexible api: https://www.backblaze.com/b2/docs/

const B2_KEY_ID = process.env.B2_KEY_ID || "";
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY || "";
export const B2_BUCKET = process.env.B2_BUCKET || "";
export const IMAGE_MAX_BYTES = parseInt(
  process.env.IMAGE_MAX_BYTES || "10485760",
  10
);

interface AuthData {
  apiUrl: string;
  authToken: string;
  downloadUrl: string;
  bucketId: string;
}

let auth: AuthData | null = null;

export function assertB2Configured() {
  if (!B2_KEY_ID || !B2_APPLICATION_KEY || !B2_BUCKET) {
    throw new Error(
      "FATAL: B2 storage not configured (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET)"
    );
  }
}

async function ensureAuth(): Promise<AuthData> {
  if (auth) return auth;
  const res = await fetch(
    `https://api.backblazeb2.com/b2api/v3/b2_authorize_account`,
    {
      method: "POST",
      headers: {
        Authorization: "Basic " + btoa(`${B2_KEY_ID}:${B2_APPLICATION_KEY}`),
      },
    }
  );
  const body: any = await res.json();
  if (!res.ok) {
    throw new AppError(`B2 authorize failed: ${body.message || "unknown"}`, 500);
  }
  auth = {
    apiUrl: body.apiUrl,
    authToken: body.authorizationToken,
    downloadUrl: body.downloadUrl,
    bucketId: body.allowed?.bucketId || "",
  };
  if (!auth.bucketId) {
    throw new AppError("B2: no bucket allowed for this key", 500);
  }
  return auth;
}

function publicUrl(key: string): string {
  return `${auth!.downloadUrl}/file/${B2_BUCKET}/${key}`;
}

// Extract the object key from a stored public URL (ours only, else null)
export function keyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/file/${B2_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export async function uploadObject(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const a = await ensureAuth();
  // Bucket is public: we store the "main" object's read URL.
  // B2 upload requires an "upload URL" token — get it per bucket.
  const urlRes = await fetch(
    `${a.apiUrl}/b2api/v3/b2_get_upload_url?bucketId=${a.bucketId}`,
    {
      headers: { Authorization: a.authToken },
    }
  );
  const urlBody: any = await urlRes.json();
  if (!urlRes.ok) {
    throw new AppError(`B2 upload-url failed: ${urlBody.message || "unknown"}`, 500);
  }

  const sha1 = createHash("sha1").update(buffer).digest("hex");
  const upRes = await fetch(urlBody.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: urlBody.authorizationToken,
      "X-Bz-File-Name": encodeURIComponent(key),
      "Content-Type": contentType,
      "X-Bz-Content-Sha1": sha1,
      "Content-Length": String(buffer.byteLength),
    },
    body: new Uint8Array(buffer),
  });
  const upBody: any = await upRes.json();
  if (!upRes.ok) {
    throw new AppError(`B2 upload failed: ${upBody.message || "unknown"}`, 500);
  }
  return publicUrl(key);
}

export async function deleteObject(key: string): Promise<void> {
  const a = await ensureAuth();
  // fileId required by B2; look it up by exact fileName via list.
  const listRes = await fetch(
    `${a.apiUrl}/b2api/v3/b2_list_file_names?bucketId=${a.bucketId}&prefix=${encodeURIComponent(key)}&maxFileCount=1`,
    { headers: { Authorization: a.authToken } }
  );
  const listBody: any = await listRes.json();
  if (!listRes.ok) {
    throw new AppError(`B2 list failed: ${listBody.message || "unknown"}`, 500);
  }
  const file = listBody.files?.find((f: any) => f.fileName === key);
  if (!file) return; // nothing to delete

  const delRes = await fetch(
    `${a.apiUrl}/b2api/v3/b2_delete_file_version?fileName=${encodeURIComponent(file.fileName)}&fileId=${file.fileId}`,
    { headers: { Authorization: a.authToken } }
  );
  if (!delRes.ok) {
    const body: any = await delRes.json();
    throw new AppError(`B2 delete failed: ${body.message || "unknown"}`, 500);
  }
}

// UPL-09: remove main + thumb objects for a stored URL (only if ours).
export async function deleteAssetsByUrl(httpUrl: string | null | undefined): Promise<void> {
  const key = keyFromUrl(httpUrl);
  if (!key) return;
  // key like uploads/2026/<uuid>.webp, thumb key = <base>_thumb.webp
  const thumbKey = key.replace(/\.webp$/, "_thumb.webp");
  await Promise.allSettled([deleteObject(key), deleteObject(thumbKey)]);
}