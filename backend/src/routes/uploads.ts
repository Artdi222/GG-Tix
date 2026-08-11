import { Hono } from "hono";
import { authMiddleware, superAdminOnly, rateLimit } from "../lib/middleware";
import { uploadImage } from "../services/upload.service";
import { IMAGE_MAX_BYTES } from "../lib/storage";

const uploadRoute = new Hono();

const uploadLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  max: 10,
});

// POST /api/uploads — multipart: file + form `kind` (profile|banner|venue)
uploadRoute.post("/", authMiddleware, superAdminOnly, uploadLimiter, async (c) => {
  // Early guard so we don't buffer an oversized body into memory.
  const contentLength = Number(c.req.header("content-length") || 0);
  if (contentLength > IMAGE_MAX_BYTES + 1024) {
    return c.json({ error: "Ukuran gambar maksimal 10 MB." }, 413 as any);
  }

  const form = await c.req.formData();
  const file = form.get("file");
  const kind = form.get("kind");

  if (!(file instanceof File)) {
    return c.json({ error: "File gambar wajib dikirim." }, 400);
  }

  const result = await uploadImage(file, typeof kind === "string" ? kind : null);

  return c.json(
    {
      message: "Upload success",
      data: result,
    },
    201
  );
});

export default uploadRoute;