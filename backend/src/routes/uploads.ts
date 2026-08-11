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
  const contentType = c.req.header("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return c.json({ error: "File gambar wajib dikirim dengan format multipart/form-data." }, 400);
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json({ error: "Gagal memproses body upload. Pastikan file dikirim sebagai multipart/form-data." }, 400);
  }

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