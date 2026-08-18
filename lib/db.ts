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
    connectionTimeoutMillis: 30000,
    keepAlive: true,
  });

  pool.on("error", (err) => {
    // Neon serverless periodically drops idle connections — catch this to prevent unhandled process crashes
    console.warn("[pg:pool] Idle database client connection closed:", err.message);
  });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  return { client, pool };
}

export type DirectoryLeadDelegate = {
  findMany: (args?: any) => Promise<any[]>;
  findUnique: (args: any) => Promise<any | null>;
  findFirst: (args?: any) => Promise<any | null>;
  create: (args: any) => Promise<any>;
  update: (args: any) => Promise<any>;
  delete: (args: any) => Promise<any>;
  deleteMany: (args?: any) => Promise<any>;
  count: (args?: any) => Promise<number>;
  groupBy: (args: any) => Promise<any[]>;
  upsert: (args: any) => Promise<any>;
};

export type FullPrismaClient = PrismaClient & {
  directoryLead: DirectoryLeadDelegate;
};

export function getDb(): PrismaClient {
  const current = globalForPrisma.prisma;
  if (!current || typeof (current as any).directoryLead?.findMany !== "function") {
    const { client, pool } = createPrismaClient();
    globalForPrisma.prisma = client;
    globalForPrisma.pool = pool;
    return client;
  }
  return current;
}

export const prisma: FullPrismaClient = new Proxy({} as FullPrismaClient, {
  get(_target, prop) {
    const client = getDb();
    const val = (client as any)[prop];
    return typeof val === "function" ? val.bind(client) : val;
  },
});

