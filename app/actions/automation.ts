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
 * Public helper (no auth) used by background jobs before firing to check
 * whether the automation for a given template is currently enabled.
 * Missing rules default to `true` so a template just added to the code
 * doesn't get suppressed until an admin toggles it.
 */
export async function isAutomationEnabled(templateId: string): Promise<boolean> {
  const row = await prisma.automationRule.findUnique({ where: { templateId } });
  return row ? row.enabled : true;
}

/* ─────────── scheduler (lib/jobs) ─────────── */

export async function getSchedulerStatusAction() {
  await requireAdmin();
  const { getSchedulerStatus } = await import("@/lib/jobs");
  return getSchedulerStatus();
}

/** Admin "Run now" — one full scheduler pass, same as a cron heartbeat. */
export async function runSchedulerNowAction() {
  await requireAdmin();
  const { tick } = await import("@/lib/jobs");
  const result = await tick("admin", 25_000);
  revalidatePath("/admin");
  return result;
}

/** Re-queue a job that exhausted its retries. */
export async function retryFailedJobAction(jobId: string) {
  await requireAdmin();
  await prisma.jobQueue.update({
    where: { id: jobId },
    data: { status: "PENDING", attempts: 0, runAt: new Date(), lastError: null, finishedAt: null, lockedUntil: null },
  });
  const { kick } = await import("@/lib/jobs");
  kick();
}
