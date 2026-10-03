import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "./env.js";

export const pool = new Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle({ client: pool, casing: "snake_case" });

export type Database = typeof db;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Executor = Database | Transaction;
