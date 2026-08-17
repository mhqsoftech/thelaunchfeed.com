import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function getConnectionString(): string {
  const raw = process.env.DATABASE_URL || "";
  // In pg / pg-connection-string v3 preparation, 'sslmode=require' produces a SECURITY WARNING.
  // Normalizing to 'sslmode=verify-full' silences the warning while maintaining strict verification.
  return raw.replace(/([?&])sslmode=require\b/g, "$1sslmode=verify-full");
}

const connectionString = getConnectionString();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pool?: Pool;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  pool.on("error", (err) => {
    // Neon serverless periodically drops idle connections — catch this to prevent unhandled process crashes
    console.warn("[pg:pool] Idle database client connection closed:", err.message);
  });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  return { client, pool };
}

if (!globalForPrisma.prisma) {
  const { client, pool } = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.pool = pool;
}

export const prisma = globalForPrisma.prisma!;

