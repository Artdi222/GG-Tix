import { Hono } from "hono";
import { db } from "../db";
import { sql } from "drizzle-orm";

const health = new Hono();

health.get("/", async (c) => {
  try {
    // Quick DB query check
    await db.execute(sql`SELECT 1`);
    return c.json({
      status: "ok",
      service: "GG Tix Backend API",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return c.json(
      {
        status: "degraded",
        service: "GG Tix Backend API",
        database: "disconnected",
        error: err.message,
        timestamp: new Date().toISOString(),
      },
      503
    );
  }
});

export default health;
