"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export async function listAutomationRules() {
  await requireAdmin();
  return prisma.automationRule.findMany({ orderBy: { templateId: "asc" } });
}

export async function setAutomationEnabled(templateId: string, enabled: boolean) {
  await requireAdmin();
  await prisma.automationRule.upsert({
    where: { templateId },
    create: { templateId, trigger: "manual", enabled },
    update: { enabled },
  });
  revalidatePath("/admin");
}

/**
 * Public helper (no auth) used by Inngest functions before firing to check
 * whether the automation for a given template is currently enabled.
 * Missing rules default to `true` so a template just added to the code
 * doesn't get suppressed until an admin toggles it.
 */
export async function isAutomationEnabled(templateId: string): Promise<boolean> {
  const row = await prisma.automationRule.findUnique({ where: { templateId } });
  return row ? row.enabled : true;
}
