"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function listCategories() {
  return prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true },
  });
}

const CreateSchema = z.object({ name: z.string().min(1).max(80) });

export async function addCategory(name: string) {
  const admin = await requireAdmin();
  const parsed = CreateSchema.parse({ name });
  const slug = slugify(parsed.name);
  await prisma.category.upsert({
    where: { slug },
    create: { slug, name: parsed.name.trim(), createdById: admin.id },
    update: { name: parsed.name.trim() },
  });
  revalidatePath("/admin");
  revalidatePath("/submit");
}

export async function removeCategory(id: string) {
  await requireAdmin();
  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin");
  revalidatePath("/submit");
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
