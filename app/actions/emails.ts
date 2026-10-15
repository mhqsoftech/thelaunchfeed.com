"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { EmailTemplateId, TemplateVars } from "@/app/admin/emailTemplates";

const SendSchema = z.object({
  templateId: z.string(),
  to: z.string().email(),
  vars: z.record(z.string(), z.unknown()).optional(),
});

const BroadcastSchema = z.object({
  templateId: z.string(),
  vars: z.record(z.string(), z.unknown()).optional(),
});

export async function sendOne(input: {
  templateId: EmailTemplateId;
  to: string;
  vars?: TemplateVars;
}) {
  const admin = await requireAdmin();
  const parsed = SendSchema.parse(input);

  const { emit } = await import("@/lib/jobs");
  await emit("email.send.requested", {
    templateId: parsed.templateId,
    to: parsed.to,
    vars: parsed.vars ?? {},
    actorId: admin.id,
    trigger: "manual",
  });

  revalidatePath("/admin");
}

export async function broadcastToAllUsers(input: {
  templateId: EmailTemplateId;
  vars?: TemplateVars;
}) {
  const admin = await requireAdmin();
  const parsed = BroadcastSchema.parse(input);
  const users = await prisma.user.findMany({ select: { id: true, email: true } });

  const { emitMany } = await import("@/lib/jobs");
  await emitMany(
    "email.send.requested",
    users.map((u) => ({
      templateId: parsed.templateId,
      to: u.email,
      toUserId: u.id,
      vars: parsed.vars ?? {},
      actorId: admin.id,
      trigger: "broadcast",
    }))
  );

  revalidatePath("/admin");
  return users.length;
}

export async function listEmailLog(limit = 100) {
  await requireAdmin();
  return prisma.emailLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
