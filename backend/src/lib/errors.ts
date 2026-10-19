import { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

export class AppError extends Error {
  public statusCode: number;
  public fields?: Record<string, string>;

  constructor(message: string, statusCode: number = 400, fields?: Record<string, string>) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.fields = fields;
  }
}

export function errorHandler(err: Error, c: Context) {
  const requestId = c.get("requestId");

  if (err instanceof AppError) {
    return c.json(
      {
        error: err.message,
        requestId,
        ...(err.fields ? { fields: err.fields } : {}),
      },
      err.statusCode as any
    );
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    err.errors.forEach((issue) => {
      const fieldName = issue.path.join(".");
      fields[fieldName] = issue.message;
    });

    return c.json(
      {
        error: "Validation failed",
        requestId,
        fields,
      },
      422
    );
  }

  if (err instanceof HTTPException) {
    return c.json({ error: err.message, requestId }, err.status);
  }

  // Postgres constraint violations are client conflicts, not server faults.
  // Drizzle may wrap the driver error in `cause`.
  const pgCode = (err as { code?: string }).code ?? (err.cause as { code?: string } | undefined)?.code;
  if (pgCode === "23503") {
    return c.json({ error: "Data ini masih digunakan oleh data lain (misalnya pesanan atau event) sehingga tidak dapat dihapus atau diubah.", requestId }, 409);
  }
  if (pgCode === "23505") {
    return c.json({ error: "Data dengan nilai yang sama sudah ada.", requestId }, 409);
  }

  console.error(`[Unhandled Server Error] ReqID: ${requestId || "-"}`, err);
  return c.json({ error: "Internal Server Error", requestId }, 500);
}
