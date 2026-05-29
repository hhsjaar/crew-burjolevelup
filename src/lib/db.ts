import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const connectionString =
  process.env.DIRECT_URL ||
  process.env.DATABASE_URL?.replace(/\?pgbouncer=true(&connection_limit=\d+)?/, "");

if (!connectionString) {
  console.warn("DATABASE_URL/DIRECT_URL is not defined in environment variables!");
}

const pool = new Pool({
  connectionString,
  ssl: connectionString?.includes("supabase.com") ? { rejectUnauthorized: false } : false,
  options: "-c search_path=absensi",
});
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
