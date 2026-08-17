"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

export interface DirectoryEmbedItem {
  id: string;
  name: string;
  embedHtml: string;
  targetUrl?: string;
  enabled: boolean;
  order: number;
  createdAt: string;
}

const SETTING_KEY = "site.directory_embeds";

/**
 * Public fetcher for active directory embeds.
 * Returns only enabled embeds sorted by order.
 */
export async function getDirectoryEmbeds(): Promise<DirectoryEmbedItem[]> {
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (!row || !Array.isArray(row.value)) {
      return [];
    }

    const items = row.value as unknown as DirectoryEmbedItem[];
    return items
      .filter((item) => item && item.enabled !== false && typeof item.embedHtml === "string")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (err) {
    console.error("[getDirectoryEmbeds] Error loading embeds:", err);
    return [];
  }
}

/**
 * Admin fetcher for all directory embeds (including disabled ones).
 */
export async function getAdminDirectoryEmbeds(): Promise<DirectoryEmbedItem[]> {
  await requireAdmin();
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (!row || !Array.isArray(row.value)) {
      return [];
    }

    const items = row.value as unknown as DirectoryEmbedItem[];
    return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch (err) {
    console.error("[getAdminDirectoryEmbeds] Error loading embeds:", err);
    return [];
  }
}

const SaveEmbedSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Directory name is required").max(100),
  embedHtml: z.string().min(1, "Embed code is required"),
  targetUrl: z.string().url().optional().or(z.literal("")),
  enabled: z.boolean().default(true),
  order: z.number().default(0),
});

/**
 * Creates or updates a directory embed code in AppSetting.
 */
export async function saveDirectoryEmbed(input: {
  id?: string;
  name: string;
  embedHtml: string;
  targetUrl?: string;
  enabled?: boolean;
  order?: number;
}): Promise<{ success: boolean; error?: string; item?: DirectoryEmbedItem }> {
  await requireAdmin();
  const parsed = SaveEmbedSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message || "Invalid embed data" };
  }

  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    let items: DirectoryEmbedItem[] =
      row && Array.isArray(row.value) ? (row.value as unknown as DirectoryEmbedItem[]) : [];

    const now = new Date().toISOString();
    let savedItem: DirectoryEmbedItem;

    if (parsed.data.id) {
      // Update existing
      const idx = items.findIndex((i) => i.id === parsed.data.id);
      if (idx === -1) {
        return { success: false, error: "Directory embed not found" };
      }
      savedItem = {
        ...items[idx],
        name: parsed.data.name.trim(),
        embedHtml: parsed.data.embedHtml.trim(),
        targetUrl: parsed.data.targetUrl ? parsed.data.targetUrl.trim() : undefined,
        enabled: parsed.data.enabled ?? items[idx].enabled ?? true,
        order: parsed.data.order ?? items[idx].order ?? idx,
      };
      items[idx] = savedItem;
    } else {
      // Create new
      savedItem = {
        id: `embed_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
        name: parsed.data.name.trim(),
        embedHtml: parsed.data.embedHtml.trim(),
        targetUrl: parsed.data.targetUrl ? parsed.data.targetUrl.trim() : undefined,
        enabled: parsed.data.enabled ?? true,
        order: parsed.data.order ?? items.length,
        createdAt: now,
      };
      items.push(savedItem);
    }

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: items as any },
      update: { value: items as any },
    });

    revalidatePath("/");
    revalidatePath("/admin");

    return { success: true, item: savedItem };
  } catch (err: any) {
    console.error("[saveDirectoryEmbed] Error:", err);
    return { success: false, error: err?.message || "Failed to save directory embed" };
  }
}

/**
 * Deletes a directory embed.
 */
export async function deleteDirectoryEmbed(id: string): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (!row || !Array.isArray(row.value)) {
      return { success: true };
    }

    const items = (row.value as unknown as DirectoryEmbedItem[]).filter((i) => i.id !== id);

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: items as any },
      update: { value: items as any },
    });

    revalidatePath("/");
    revalidatePath("/admin");

    return { success: true };
  } catch (err: any) {
    console.error("[deleteDirectoryEmbed] Error:", err);
    return { success: false, error: err?.message || "Failed to delete directory embed" };
  }
}

/**
 * Toggles an embed item's active/inactive status.
 */
export async function toggleDirectoryEmbed(
  id: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (!row || !Array.isArray(row.value)) {
      return { success: false, error: "Settings not found" };
    }

    const items = (row.value as unknown as DirectoryEmbedItem[]).map((i) => {
      if (i.id === id) {
        return { ...i, enabled };
      }
      return i;
    });

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: items as any },
      update: { value: items as any },
    });

    revalidatePath("/");
    revalidatePath("/admin");

    return { success: true };
  } catch (err: any) {
    console.error("[toggleDirectoryEmbed] Error:", err);
    return { success: false, error: err?.message || "Failed to toggle status" };
  }
}

/**
 * Reorders directory embeds.
 */
export async function reorderDirectoryEmbeds(
  orderedIds: string[]
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  try {
    const row = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (!row || !Array.isArray(row.value)) {
      return { success: true };
    }

    const items = row.value as unknown as DirectoryEmbedItem[];
    const itemMap = new Map(items.map((i) => [i.id, i]));

    const reordered: DirectoryEmbedItem[] = [];
    orderedIds.forEach((id, idx) => {
      const item = itemMap.get(id);
      if (item) {
        reordered.push({ ...item, order: idx });
        itemMap.delete(id);
      }
    });

    // Add remaining items
    Array.from(itemMap.values()).forEach((item) => {
      reordered.push({ ...item, order: reordered.length });
    });

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: { key: SETTING_KEY, value: reordered as any },
      update: { value: reordered as any },
    });

    revalidatePath("/");
    revalidatePath("/admin");

    return { success: true };
  } catch (err: any) {
    console.error("[reorderDirectoryEmbeds] Error:", err);
    return { success: false, error: err?.message || "Failed to reorder embeds" };
  }
}
