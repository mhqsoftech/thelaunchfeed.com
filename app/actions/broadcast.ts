"use server";

import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  getBroadcastConfig,
  saveBroadcastConfig,
  getBroadcastLogs,
  sendXBroadcast,
  sendTelegramBroadcast,
  sendWhatsAppBroadcast,
  sendWebhookBroadcast,
  broadcastProductLaunch,
  type BroadcastConfig,
  type BroadcastLogItem,
} from "@/lib/broadcast";
import { prisma } from "@/lib/db";

export async function getBroadcastConfigAction(): Promise<BroadcastConfig> {
  await requireAdmin();
  return getBroadcastConfig();
}

export async function saveBroadcastConfigAction(config: BroadcastConfig): Promise<{ success: boolean }> {
  await requireAdmin();
  await saveBroadcastConfig(config);
  revalidatePath("/admin");
  return { success: true };
}

export async function getBroadcastLogsAction(): Promise<BroadcastLogItem[]> {
  await requireAdmin();
  return getBroadcastLogs(30);
}

export async function testBroadcastAction(
  channel: "x" | "telegram" | "whatsapp" | "webhook"
): Promise<{ success: boolean; message: string }> {
  await requireAdmin();
  const config = await getBroadcastConfig();
  const siteBase = process.env.NEXT_PUBLIC_APP_URL || "https://thelaunchfeed.com";
  const testUrl = `${siteBase}`;

  if (channel === "x") {
    const text = `🧪 Test verification from The Launch Feed Auto-Publisher (${new Date().toLocaleTimeString()}). Connectivity verified!\n\n${testUrl}\n\n#TheLaunchFeed #DevTools`;
    return sendXBroadcast(text, config.x);
  }

  if (channel === "telegram") {
    const html = `🧪 <b>Test verification from The Launch Feed Auto-Publisher</b> (${new Date().toLocaleTimeString()}).\n\nConnectivity verified successfully!\n<a href="${testUrl}">${testUrl}</a>`;
    return sendTelegramBroadcast(html, config.telegram);
  }

  if (channel === "whatsapp") {
    const text = `🧪 *Test verification from The Launch Feed Auto-Publisher* (${new Date().toLocaleTimeString()}). Connectivity verified successfully!\n\n${testUrl}`;
    return sendWhatsAppBroadcast(text, config.whatsapp);
  }

  if (channel === "webhook") {
    const payload = {
      event: "test.ping",
      message: `Test ping from The Launch Feed Auto-Publisher (${new Date().toLocaleTimeString()})`,
      testUrl,
      text: `🚀 Test ping from The Launch Feed: Ready to auto-post product drops to X for $0.00! ${testUrl}`,
      timestamp: new Date().toISOString(),
    };
    return sendWebhookBroadcast(payload, config.webhook);
  }

  return { success: false, message: "Unknown channel specified" };
}

export async function triggerManualBroadcastAction(
  productId: string
): Promise<BroadcastLogItem> {
  await requireAdmin();
  const prod = await prisma.product.findUnique({
    where: { id: productId },
    include: { owner: true, category: true },
  });
  if (!prod) throw new Error("PRODUCT_NOT_FOUND");

  const result = await broadcastProductLaunch({
    id: prod.id,
    name: prod.name,
    slug: prod.slug,
    tagline: prod.tagline,
    makerName: prod.owner?.name || prod.owner?.username || "Founder",
    makerHandle: prod.owner?.username ? `@${prod.owner.username}` : undefined,
    category: prod.category?.name || undefined,
    tags: prod.tags || [],
    websiteUrl: prod.websiteUrl,
  });

  revalidatePath("/admin");
  return result;
}
