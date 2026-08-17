"use server";

import { requireAdmin } from "@/lib/auth";
import {
  getBaileysStatus,
  initBaileysSocket,
  disconnectBaileys,
  sendBaileysMessage,
  fetchBaileysGroups,
} from "@/lib/baileys";
import { revalidatePath } from "next/cache";

export async function getBaileysStatusAction() {
  await requireAdmin();
  return getBaileysStatus();
}

export async function initBaileysAction() {
  await requireAdmin();
  const res = await initBaileysSocket();
  return {
    status: res.status,
    qrCodeDataUrl: res.qrCodeDataUrl,
    userInfo: res.userInfo,
    lastError: res.lastError,
  };
}

export async function disconnectBaileysAction() {
  await requireAdmin();
  await disconnectBaileys();
  revalidatePath("/admin");
  return { success: true };
}

export async function getBaileysGroupsAction() {
  await requireAdmin();
  return fetchBaileysGroups();
}

export async function testBaileysMessageAction(chatId: string, text?: string) {
  await requireAdmin();
  const message =
    text ||
    `🧪 *Test verification from The Launch Feed Auto-Publisher* (${new Date().toLocaleTimeString()}).\n\nWhatsApp connection via Baileys is working!`;
  return sendBaileysMessage(chatId, message);
}
