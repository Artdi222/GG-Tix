import type { Context, Next } from "hono";
import { Hono } from "hono";
import { z } from "zod";
import { B2_BUCKET, cachedDownloadUrl, fetchObject } from "./storage";

/**
 * The B2 bucket is private, so browsers and the app cannot load its URLs directly.
 * The database keeps the canonical B2 URL (asset cleanup depends on it); responses
 * rewrite it to this API's /api/media proxy, and inputs map proxy URLs back.
 */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const B2_URL = new RegExp(`https://f\\d+\\.backblazeb2\\.com/file/${escapeRe(B2_BUCKET)}/`, "g");
const PROXY_URL = /^https?:\/\/[^/]+\/api\/media\/(.+)$/;
const SAFE_KEY = /^uploads\/[A-Za-z0-9/_-]+\.(webp|png|jpe?g)$/;

/** Proxy URL (from a client that echoes back what it was given) -> canonical B2 URL. */
export function canonicalMediaUrl(url: string): string {
  const m = url.match(PROXY_URL);
  if (!m) return url;
  const host = cachedDownloadUrl() ?? process.env.B2_DOWNLOAD_URL ?? "https://f005.backblazeb2.com";
  return `${host}/file/${B2_BUCKET}/${m[1]}`;
}

/** Zod field for a stored image URL: validated, then normalised to the canonical B2 form. */
export const mediaUrlField = (message = "Invalid image URL format") =>
  z.string().url(message).transform(canonicalMediaUrl);

function requestOrigin(c: Context): string {
  const url = new URL(c.req.url);
  const proto = c.req.header("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  const host = c.req.header("x-forwarded-host")?.split(",")[0]?.trim() || c.req.header("host") || url.host;
  return `${proto}://${host}`;
}

/** Rewrites B2 URLs in JSON responses to the host the client actually used, so localhost
 *  admin and the phone on the LAN IP both get a reachable address. */
export async function mediaUrlRewrite(c: Context, next: Next) {
  await next();
  if (!c.res.headers.get("content-type")?.includes("application/json")) return;
  const body = await c.res.clone().text();
  B2_URL.lastIndex = 0;
  if (!B2_URL.test(body)) return;
  const rewritten = body.replace(B2_URL, `${requestOrigin(c)}/api/media/`);
  const headers = new Headers(c.res.headers);
  headers.delete("content-length");
  c.res = new Response(rewritten, { status: c.res.status, headers });
}

/** GET /api/media/uploads/... — streams a private B2 object. Keys are random UUIDs and never
 *  rewritten, so responses are cached for a year. */
export const mediaRoute = new Hono();
mediaRoute.get("/*", async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^.*?\/media\//, ""));
  if (!SAFE_KEY.test(key) || key.includes("..")) return c.json({ error: "Not found" }, 404);
  let upstream: Response;
  try {
    upstream = await fetchObject(key);
  } catch {
    return c.json({ error: "Gambar tidak dapat dimuat." }, 502);
  }
  if (!upstream.ok) return c.json({ error: "Not found" }, upstream.status === 404 ? 404 : 502);
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  });
});
