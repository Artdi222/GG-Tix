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
  if (err instanceof AppError) {
    return c.json(
      {
        error: err.message,
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
        fields,
      },
      422
    );
  }

  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }

  console.error("Unhandled Server Error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
}
