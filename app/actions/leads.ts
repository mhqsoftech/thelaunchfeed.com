"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  crawlDirectoryUrl,
  extractLeadsFromText,
  saveBulkLeads,
} from "@/lib/crawler/directoryCrawler";
import {
  PREDEFINED_DIRECTORIES,
  DEFAULT_AUTO_CONFIG,
  DEFAULT_AUTO_CRAWLER_CONFIG,
  type AutoOutreachConfig,
  type AutoCrawlerConfig,
  type CustomDirectory,
  type ExtractedLead,
} from "@/lib/crawler/constants";
import { getTemplate } from "@/app/admin/emailTemplates";
import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;
const FROM = process.env.EMAIL_FROM || "The Launch Feed <team@thelaunchfeed.com>";

export type { AutoOutreachConfig, AutoCrawlerConfig, CustomDirectory, ExtractedLead };

export interface DirectoryLeadsOverview {
  leads: Array<{
    id: string;
    name: string;
    email: string;
    organization: string;
    productUrl: string | null;
    sourceDirectory: string;
    sourceUrl: string | null;
    status: "NEW" | "EMAILED" | "CONVERTED" | "BOUNCED" | "UNSUBSCRIBED";
    notes: string | null;
    lastEmailedAt: string | null;
    emailCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  stats: {
    totalLeads: number;
    newLeads: number;
    emailedLeads: number;
    convertedLeads: number;
    bouncedLeads: number;
  };
  directories: Array<{
    name: string;
    count: number;
  }>;
  predefinedDirectories: (typeof PREDEFINED_DIRECTORIES[0] & { isCustom?: boolean })[];
  customDirectories: CustomDirectory[];
  autoConfig: AutoOutreachConfig;
  autoCrawlerConfig: AutoCrawlerConfig;
}

/**
 * Gets all directory leads, stats, and auto-outreach settings for the admin dashboard
 */
export async function getDirectoryLeadsOverviewAction(): Promise<DirectoryLeadsOverview> {
  await requireAdmin();

  const db = prisma as any;
  let leads: any[] = [];
  let totalLeads = 0;
  let newLeads = 0;
  let emailedLeads = 0;
  let convertedLeads = 0;
  let bouncedLeads = 0;
  let sourceDistribution: { sourceDirectory: string; _count: { id: number } }[] = [];
  try {
    const [allLeads, tCount, nCount, eCount, cCount, bCount, dirGroups] = await Promise.all([
      prisma.directoryLead.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: 2000,
      }),
      prisma.directoryLead.count(),
      prisma.directoryLead.count({ where: { status: "NEW" } }),
      prisma.directoryLead.count({ where: { status: "EMAILED" } }),
      prisma.directoryLead.count({ where: { status: "CONVERTED" } }),
      prisma.directoryLead.count({ where: { status: "BOUNCED" } }),
      prisma.directoryLead.groupBy({
        by: ["sourceDirectory"],
        _count: { id: true },
      }),
    ]);

    leads = allLeads;
    totalLeads = tCount;
    newLeads = nCount;
    emailedLeads = eCount;
    convertedLeads = cCount;
    bouncedLeads = bCount;
    sourceDistribution = dirGroups as any;
  } catch (err) {
    console.warn("[outreach] Error loading directory leads:", err);
  }

  // Load Auto Outreach Configuration from AppSetting
  let autoConfig = DEFAULT_AUTO_CONFIG;
  try {
    if (prisma?.appSetting) {
      const setting = await prisma.appSetting.findUnique({
        where: { key: "auto_outreach_config" },
      });
      if (setting && setting.value) {
        autoConfig = { ...DEFAULT_AUTO_CONFIG, ...(setting.value as any) };
      }
    }
  } catch (err) {
    console.warn("[outreach] Error loading auto outreach config:", err);
  }

  // Load Custom Directories from AppSetting
  let customDirectories: CustomDirectory[] = [];
  try {
    if (prisma?.appSetting) {
      const setting = await prisma.appSetting.findUnique({
        where: { key: "custom_directories" },
      });
      if (setting && Array.isArray(setting.value)) {
        customDirectories = setting.value as unknown as CustomDirectory[];
      }
    }
  } catch (err) {
    console.warn("[outreach] Error loading custom directories:", err);
  }

  // Load Auto Crawler Configuration from AppSetting
  let autoCrawlerConfig = DEFAULT_AUTO_CRAWLER_CONFIG;
  try {
    if (prisma?.appSetting) {
      const setting = await prisma.appSetting.findUnique({
        where: { key: "auto_crawler_config" },
      });
      if (setting && setting.value) {
        autoCrawlerConfig = { ...DEFAULT_AUTO_CRAWLER_CONFIG, ...(setting.value as any) };
      }
    }
  } catch (err) {
    console.warn("[outreach] Error loading auto crawler config:", err);
  }

  // Combined predefined and custom directories
  const combinedDirectories: (typeof PREDEFINED_DIRECTORIES[0] & { isCustom?: boolean })[] = [
    ...PREDEFINED_DIRECTORIES.map((d) => ({ ...d, isCustom: false })),
    ...customDirectories.map((cd) => ({
      id: cd.id,
      name: cd.name,
      url: cd.url,
      description: cd.description,
      category: cd.category,
      isCustom: true,
    })),
  ];

  return {
    leads: leads.map((l) => ({
      id: l.id,
      name: l.name,
      email: l.email,
      organization: l.organization,
      productUrl: l.productUrl,
      sourceDirectory: l.sourceDirectory,
      sourceUrl: l.sourceUrl,
      status: l.status,
      notes: l.notes,
      lastEmailedAt: l.lastEmailedAt ? new Date(l.lastEmailedAt).toISOString() : null,
      emailCount: l.emailCount,
      createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: l.updatedAt ? new Date(l.updatedAt).toISOString() : new Date().toISOString(),
    })),
    stats: {
      totalLeads,
      newLeads,
      emailedLeads,
      convertedLeads,
      bouncedLeads,
    },
    directories: sourceDistribution.map((d) => ({
      name: d.sourceDirectory,
      count: d._count.id,
    })),
    predefinedDirectories: combinedDirectories,
    customDirectories,
    autoConfig,
    autoCrawlerConfig,
  };
}

/**
 * Crawls a product submission directory URL, extracts leads, and saves unique records
 */
export async function crawlDirectoryAction(url: string, sourceDirectoryName?: string) {
  await requireAdmin();

  if (!url || !url.trim()) {
    throw new Error("URL is required to crawl");
  }

  const result = await crawlDirectoryUrl(url, sourceDirectoryName);

  // If auto-send on crawl is enabled in config, dispatch outreach to newly saved leads
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: "auto_outreach_config" },
    });
    const config: AutoOutreachConfig = setting?.value
      ? { ...DEFAULT_AUTO_CONFIG, ...(setting.value as any) }
      : DEFAULT_AUTO_CONFIG;

    if (config.enabled && config.autoSendOnCrawl && result.leads.length > 0) {
      // Find the newly saved leads in DB that are in NEW status
      const emails = result.leads.map((l) => l.email);
      const db = prisma as any;
      const newSavedLeads = await db.directoryLead.findMany({
        where: {
          email: { in: emails },
          status: "NEW",
        },
        take: config.dailyLimit || 50,
      });

      if (newSavedLeads.length > 0) {
        await sendOutreachCampaignAction(newSavedLeads.map((l: any) => l.id));
      }
    }
  } catch (autoErr) {
    console.warn("[outreach] Auto-send on crawl error:", autoErr);
  }

  revalidatePath("/admin");
  return result;
}

/**
 * Parses raw pasted text / CSV / HTML and bulk-saves unique leads
 */
export async function importRawLeadsAction(rawText: string, defaultDirectory = "Manual Import") {
  await requireAdmin();

  if (!rawText || !rawText.trim()) {
    throw new Error("Content cannot be empty");
  }

  const extracted = extractLeadsFromText(rawText, defaultDirectory);
  if (extracted.length === 0) {
    throw new Error("No valid contact emails could be extracted from the provided text.");
  }

  const result = await saveBulkLeads(extracted);
  revalidatePath("/admin");
  return { ...result, leads: extracted };
}

/**
 * Updates the Auto Outreach Configuration
 */
export async function updateAutoOutreachConfigAction(config: Partial<AutoOutreachConfig>) {
  await requireAdmin();

  const current = await prisma.appSetting.findUnique({
    where: { key: "auto_outreach_config" },
  });

  const merged = {
    ...DEFAULT_AUTO_CONFIG,
    ...(current?.value as any),
    ...config,
  };

  await prisma.appSetting.upsert({
    where: { key: "auto_outreach_config" },
    create: {
      key: "auto_outreach_config",
      value: merged,
    },
    update: {
      value: merged,
    },
  });

  revalidatePath("/admin");
  return merged;
}

/**
 * Sends branded outreach emails to selected directory leads
 */
export async function sendOutreachCampaignAction(
  leadIds: string[],
  options?: { testEmail?: string; overrideSubject?: string }
) {
  await requireAdmin();
  return _sendOutreachCampaignInternal(leadIds, options);
}

/**
 * Internal (no auth) worker used by admin-gated wrappers and by Inngest crons
 * that have no cookie context and therefore can't satisfy requireAdmin().
 * MUST NOT be re-exported to client code — it is only invoked from other
 * server-side functions in this file and from Inngest handlers.
 */
async function _sendOutreachCampaignInternal(
  leadIds: string[],
  options?: { testEmail?: string; overrideSubject?: string }
) {
  if (!leadIds || leadIds.length === 0) {
    throw new Error("No leads selected for outreach");
  }

  const db = prisma as any;
  const leads = await db.directoryLead.findMany({
    where: { id: { in: leadIds } },
  });

  if (leads.length === 0) {
    throw new Error("Selected leads not found");
  }

  const template = getTemplate("directory-founder-invite");
  let sentCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const lead of leads) {
    const targetEmail = options?.testEmail || lead.email;
    const vars = {
      founderName: lead.name || "Founder",
      productName: lead.organization || "your product",
      sourceDirectory: lead.sourceDirectory || "product directories",
      userEmail: targetEmail,
    };

    const subject = options?.overrideSubject || template.subject(vars);
    const html = template.render(vars);

    try {
      if (resend) {
        const res = await resend.emails.send({
          from: FROM,
          to: targetEmail,
          subject,
          html,
        });

        // Log in EmailLog
        await prisma.emailLog.create({
          data: {
            toEmail: targetEmail,
            templateId: "directory-founder-invite",
            subject,
            html,
            status: "SENT",
            provider: "resend",
            providerId: res.data?.id,
            triggerEvent: "directory-outreach",
            sentAt: new Date(),
            meta: {
              leadId: lead.id,
              sourceDirectory: lead.sourceDirectory,
              organization: lead.organization,
            },
          },
        });
      } else {
        // Queued without Resend API key
        await prisma.emailLog.create({
          data: {
            toEmail: targetEmail,
            templateId: "directory-founder-invite",
            subject,
            html,
            status: "QUEUED",
            provider: "resend",
            triggerEvent: "directory-outreach",
            errorMessage: "RESEND_API_KEY not configured",
            meta: {
              leadId: lead.id,
              sourceDirectory: lead.sourceDirectory,
              organization: lead.organization,
            },
          },
        });
      }

      // If sending real outreach (not a test email), update the lead status
      if (!options?.testEmail) {
        await db.directoryLead.update({
          where: { id: lead.id },
          data: {
            status: "EMAILED",
            lastEmailedAt: new Date(),
            emailCount: { increment: 1 },
          },
        });
      }

      sentCount++;
    } catch (err: any) {
      failedCount++;
      errors.push(`${lead.email}: ${err?.message || err}`);
      console.warn(`[outreach] Error sending to ${lead.email}:`, err);
    }

    // Gentle 100ms pacing between emails
    if (leads.length > 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  revalidatePath("/admin");
  return {
    total: leads.length,
    sentCount,
    failedCount,
    errors,
  };
}

/**
 * Sends a single test email with dynamic variables to preview in the admin inbox
 */
export async function sendTestOutreachEmailAction(recipientEmail: string, sampleLeadId?: string) {
  await requireAdmin();

  if (!recipientEmail || !recipientEmail.includes("@")) {
    throw new Error("Valid test recipient email is required");
  }

  const db = prisma as any;
  let sampleLead: any = null;
  if (sampleLeadId) {
    sampleLead = await db.directoryLead.findUnique({
      where: { id: sampleLeadId },
    });
  }

  if (!sampleLead) {
    sampleLead = {
      id: "sample",
      name: "Alex",
      email: recipientEmail,
      organization: "SuperTool AI",
      sourceDirectory: "Product Hunt",
    };
  }

  const template = getTemplate("directory-founder-invite");
  const vars = {
    founderName: sampleLead.name || "Alex",
    productName: sampleLead.organization || "SuperTool AI",
    sourceDirectory: sampleLead.sourceDirectory || "Product Hunt",
    userEmail: recipientEmail,
  };

  const subject = `[TEST PREVIEW] ${template.subject(vars)}`;
  const html = template.render(vars);

  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured in the environment.");
  }

  const res = await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject,
    html,
  });

  return { success: true, id: res.data?.id };
}

/**
 * Triggers an automated outreach batch to all pending NEW leads up to the daily limit
 */
export async function triggerAutoOutreachBatchAction() {
  await requireAdmin();
  return triggerAutoOutreachBatchInternal();
}

/**
 * Internal (no auth) — called by Inngest crons which have no session cookie
 * and cannot satisfy requireAdmin(). Do not re-export to client code.
 */
export async function triggerAutoOutreachBatchInternal() {
  const setting = await prisma.appSetting.findUnique({
    where: { key: "auto_outreach_config" },
  });
  const config: AutoOutreachConfig = setting?.value
    ? { ...DEFAULT_AUTO_CONFIG, ...(setting.value as any) }
    : DEFAULT_AUTO_CONFIG;

  const db = prisma as any;
  const limit = config.dailyLimit || 50;
  const pendingLeads = await db.directoryLead.findMany({
    where: { status: "NEW" },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  if (pendingLeads.length === 0) {
    return { count: 0, message: "No new unemailed directory leads found." };
  }

  const result = await _sendOutreachCampaignInternal(pendingLeads.map((l: any) => l.id));
  return { ...result, count: pendingLeads.length };
}

/**
 * Updates a lead's status (NEW, EMAILED, CONVERTED, BOUNCED, UNSUBSCRIBED)
 */
export async function updateLeadStatusAction(
  id: string,
  status: "NEW" | "EMAILED" | "CONVERTED" | "BOUNCED" | "UNSUBSCRIBED"
) {
  await requireAdmin();
  const db = prisma as any;
  await db.directoryLead.update({
    where: { id },
    data: { status },
  });
  revalidatePath("/admin");
}

/**
 * Deletes leads by IDs
 */
export async function deleteLeadsAction(leadIds: string[]) {
  await requireAdmin();
  const deleted = await prisma.directoryLead.deleteMany({
    where: { id: { in: leadIds } },
  });
  revalidatePath("/admin");
  return deleted.count;
}

/**
 * Adds a new custom saved directory for automated and manual crawling
 */
export async function addCustomDirectoryAction(input: {
  name: string;
  url: string;
  description?: string;
  category?: "Curated Directory" | "Daily Launchpad" | "Indie Hacker" | "AI & SaaS";
}) {
  await requireAdmin();

  if (!input.name || !input.name.trim()) throw new Error("Directory name is required.");
  if (!input.url || !input.url.trim()) throw new Error("Directory URL is required.");

  const cleanUrl = input.url.trim().startsWith("http") ? input.url.trim() : `https://${input.url.trim()}`;
  const id = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `custom-${Date.now()}`;

  const setting = await prisma.appSetting.findUnique({
    where: { key: "custom_directories" },
  });

  const existing: CustomDirectory[] = setting && Array.isArray(setting.value) ? (setting.value as unknown as CustomDirectory[]) : [];

  // Check if directory already exists
  if (existing.some((d) => d.id === id || d.url.toLowerCase() === cleanUrl.toLowerCase())) {
    throw new Error("A directory with this name or URL already exists.");
  }

  const newDirectory: CustomDirectory = {
    id,
    name: input.name.trim(),
    url: cleanUrl,
    description: input.description?.trim() || "Custom added directory for founder lead discovery.",
    category: input.category || "Daily Launchpad",
    addedAt: new Date().toISOString(),
    isCustom: true,
  };

  const updatedList = [...existing, newDirectory];

  await prisma.appSetting.upsert({
    where: { key: "custom_directories" },
    create: {
      key: "custom_directories",
      value: updatedList as any,
    },
    update: {
      value: updatedList as any,
    },
  });

  revalidatePath("/admin");
  return newDirectory;
}

/**
 * Deletes a custom saved directory
 */
export async function deleteCustomDirectoryAction(id: string) {
  await requireAdmin();

  const setting = await prisma.appSetting.findUnique({
    where: { key: "custom_directories" },
  });

  if (!setting || !Array.isArray(setting.value)) {
    return { success: true };
  }

  const existing = setting.value as unknown as CustomDirectory[];
  const updatedList = existing.filter((d) => d.id !== id);

  await prisma.appSetting.update({
    where: { key: "custom_directories" },
    data: {
      value: updatedList as any,
    },
  });

  revalidatePath("/admin");
  return { success: true };
}

/**
 * Updates the Scheduled Daily Directory Crawler configuration
 */
export async function updateAutoCrawlerConfigAction(config: Partial<AutoCrawlerConfig>) {
  await requireAdmin();

  const setting = await prisma.appSetting.findUnique({
    where: { key: "auto_crawler_config" },
  });

  const currentConfig: AutoCrawlerConfig = setting?.value
    ? { ...DEFAULT_AUTO_CRAWLER_CONFIG, ...(setting.value as any) }
    : DEFAULT_AUTO_CRAWLER_CONFIG;

  const newConfig: AutoCrawlerConfig = {
    ...currentConfig,
    ...config,
  };

  await prisma.appSetting.upsert({
    where: { key: "auto_crawler_config" },
    create: {
      key: "auto_crawler_config",
      value: newConfig as any,
    },
    update: {
      value: newConfig as any,
    },
  });

  revalidatePath("/admin");
  return newConfig;
}

/**
 * Executes a full automated daily directory crawl batch across all saved directories
 */
export async function runDailyDirectoryCrawlBatchAction(selectedDirIds?: string[]) {
  await requireAdmin();
  return runDailyDirectoryCrawlBatchInternal(selectedDirIds);
}

/**
 * Internal (no auth) — called from the Inngest cron. Do not re-export to
 * client code; heavy work that must not be triggerable by unauthenticated
 * or non-admin callers.
 */
export async function runDailyDirectoryCrawlBatchInternal(selectedDirIds?: string[]) {
  // Load custom directories
  const customSetting = await prisma.appSetting.findUnique({
    where: { key: "custom_directories" },
  });
  const customDirs: CustomDirectory[] =
    customSetting && Array.isArray(customSetting.value) ? (customSetting.value as unknown as CustomDirectory[]) : [];

  const allDirs = [
    ...PREDEFINED_DIRECTORIES,
    ...customDirs.map((cd) => ({
      id: cd.id,
      name: cd.name,
      url: cd.url,
      description: cd.description,
      category: cd.category,
    })),
  ];

  let targetDirs = allDirs;
  if (selectedDirIds && selectedDirIds.length > 0 && !selectedDirIds.includes("ALL")) {
    targetDirs = allDirs.filter((d) => selectedDirIds.includes(d.id) || selectedDirIds.includes(d.name));
  }

  let directoriesScanned = 0;
  let totalLeadsFound = 0;
  let newLeadsSaved = 0;
  let existingLeadsUpdated = 0;
  const resultsByDirectory: Array<{
    name: string;
    url: string;
    leadsFound: number;
    newSaved: number;
    status: "OK" | "ERROR";
    error?: string;
  }> = [];

  // Crawl targets sequentially / small batch to avoid rate limiting
  for (const dir of targetDirs) {
    try {
      directoriesScanned++;
      const res = await crawlDirectoryUrl(dir.url, dir.name);
      totalLeadsFound += res.leadsFound;
      newLeadsSaved += res.newLeadsSaved;
      existingLeadsUpdated += res.existingLeadsUpdated;
      resultsByDirectory.push({
        name: dir.name,
        url: dir.url,
        leadsFound: res.leadsFound,
        newSaved: res.newLeadsSaved,
        status: "OK",
      });
    } catch (err: any) {
      resultsByDirectory.push({
        name: dir.name,
        url: dir.url,
        leadsFound: 0,
        newSaved: 0,
        status: "ERROR",
        error: err?.message || "Crawl failed",
      });
    }
  }

  const now = new Date().toISOString();

  // Save run stats to AppSetting
  try {
    const crawlerSetting = await prisma.appSetting.findUnique({
      where: { key: "auto_crawler_config" },
    });
    const currentConfig: AutoCrawlerConfig = crawlerSetting?.value
      ? { ...DEFAULT_AUTO_CRAWLER_CONFIG, ...(crawlerSetting.value as any) }
      : DEFAULT_AUTO_CRAWLER_CONFIG;

    await prisma.appSetting.upsert({
      where: { key: "auto_crawler_config" },
      create: {
        key: "auto_crawler_config",
        value: {
          ...currentConfig,
          lastRunAt: now,
          lastRunStatus: resultsByDirectory.some((r) => r.status === "ERROR") ? "PARTIAL" : "SUCCESS",
          lastRunStats: {
            directoriesScanned,
            totalLeadsFound,
            newLeadsSaved,
            timestamp: now,
          },
        } as any,
      },
      update: {
        value: {
          ...currentConfig,
          lastRunAt: now,
          lastRunStatus: resultsByDirectory.some((r) => r.status === "ERROR") ? "PARTIAL" : "SUCCESS",
          lastRunStats: {
            directoriesScanned,
            totalLeadsFound,
            newLeadsSaved,
            timestamp: now,
          },
        } as any,
      },
    });
  } catch {}

  // If auto-outreach on crawl is active, trigger an automated campaign for new leads
  try {
    const outreachSetting = await prisma.appSetting.findUnique({
      where: { key: "auto_outreach_config" },
    });
    const outreachConfig: AutoOutreachConfig = outreachSetting?.value
      ? { ...DEFAULT_AUTO_CONFIG, ...(outreachSetting.value as any) }
      : DEFAULT_AUTO_CONFIG;

    if (outreachConfig.enabled && outreachConfig.autoSendOnCrawl && newLeadsSaved > 0) {
      // Use the no-auth internal — this path also runs from the Inngest cron
      // via runDailyDirectoryCrawlBatchAction and would otherwise fail its
      // requireAdmin() check silently.
      await triggerAutoOutreachBatchInternal();
    }
  } catch {}

  revalidatePath("/admin");

  return {
    directoriesScanned,
    totalLeadsFound,
    newLeadsSaved,
    existingLeadsUpdated,
    timestamp: now,
    resultsByDirectory,
  };
}
