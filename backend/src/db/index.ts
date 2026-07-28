import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL || "postgres://ggtix:ggtixpassword@localhost:5432/ggtix_db";

export const client = postgres(connectionString);
export const db = drizzle(client, { schema });
