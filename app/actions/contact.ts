"use server";

import { z } from "zod";
import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { renderEmail } from "@/lib/email/layout";

const ContactSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email("Please enter a valid email address."),
  topic: z.string().trim().min(1, "Please select a topic."),
  message: z.string().trim().min(5, "Message must be at least 5 characters long.").max(5000),
});

export type ContactFormData = z.infer<typeof ContactSchema>;

const TOPIC_LABELS: Record<string, string> = {
  general: "General Support & Inquiry",
  product: "Product Launch / Review Question",
  sponsor: "Featured Placement & Sponsorship",
  security: "Security & Vulnerability Disclosure",
  feedback: "Feedback & Feature Suggestions",
};

export async function sendContactMessage(input: ContactFormData) {
  const parsed = ContactSchema.safeParse(input);
  if (!parsed.success) {
    const err = parsed.error.issues[0]?.message || "Invalid contact form submission.";
    return { success: false, error: err };
  }

  const rawData = parsed.data;

  // Rate limit — same email cannot submit more than 5 messages per hour, and
  // no more than 20 total contact-form sends per hour globally, so the
  // endpoint cannot be turned into an email spam relay via the user-receipt
  // send path.
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  try {
    const [perEmail, global] = await Promise.all([
      prisma.emailLog.count({
        where: {
          templateId: "contact-form",
          toEmail: rawData.email,
          createdAt: { gte: oneHourAgo },
        },
      }),
      prisma.emailLog.count({
        where: { templateId: "contact-form", createdAt: { gte: oneHourAgo } },
      }),
    ]);
    if (perEmail >= 5 || global >= 20) {
      return { success: false, error: "Too many contact form submissions. Please try again later." };
    }
  } catch {
    // If the rate-limit check fails, fall through — do not block legitimate
    // users because of a transient DB blip.
  }

  // Raw values only: renderEmail escapes everything it puts into HTML, and
  // from/to/replyTo/subject are plain-text header contexts.
  const rawName = rawData.name;
  const rawEmail = rawData.email;
  const topic = rawData.topic;
  const message = rawData.message;
  const topicLabel = TOPIC_LABELS[topic] || topic;
  const subject = `[Contact Form] ${topicLabel} — ${rawName || rawEmail}`;
  const timestamp = new Date().toISOString();

  // 1. Admin / desk notification
  const adminMail = renderEmail({
    preheader: `New contact submission from ${rawName || rawEmail} (${topicLabel})`,
    eyebrow: "Contact form",
    heading: topicLabel,
    intro: [`New message from **${rawName || rawEmail}**. Reply to this email to answer them directly.`],
    details: [
      ["From", rawName ? `${rawName} <${rawEmail}>` : rawEmail],
      ["Topic", `${topicLabel} (${topic})`],
      ["Received", timestamp],
    ],
    callout: { title: "Message", body: message, tone: "neutral" },
    cta: { label: "Reply by email", url: `mailto:${rawEmail}` },
    reason: "Internal notification from the contact form on The Launch Feed.",
  });
  const adminHtml = adminMail.html;

  // 2. User receipt
  const userReceipt = renderEmail({
    preheader: `We received your message about ${topicLabel}.`,
    eyebrow: "Message received",
    eyebrowTone: "verified",
    heading: "We received your message",
    intro: [
      `Thanks for reaching out${rawName ? `, ${rawName}` : ""}. We've received your message about **${topicLabel}** and will reply within 24 hours.`,
    ],
    callout: { title: "Your message", body: message, tone: "neutral" },
    outro: ["Need to add something? Just reply to this email."],
    cta: { label: "Back to The Launch Feed", url: "/" },
    reason: "You're receiving this because you sent us a message through the contact form on The Launch Feed.",
  });

  const targetEmail = process.env.ADMIN_EMAIL || "hi@thelaunchfeed.com";
  const fromAddress = process.env.EMAIL_FROM || "The Launch Feed <hi@thelaunchfeed.com>";

  let emailStatus: "SENT" | "QUEUED" | "FAILED" = "QUEUED";
  let errorMessage: string | null = null;
  let providerId: string | null = null;

  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);

      // Send to Admin / Official inbox
      const res = await resend.emails.send({
        from: fromAddress,
        to: targetEmail,
        replyTo: rawEmail,
        subject,
        html: adminHtml,
        text: adminMail.text,
      });

      if (res.error) {
        console.warn("[contact] primary Resend send returned error:", res.error.message);
        if (res.error.name === "validation_error" || res.error.message?.includes("domain")) {
          const fallbackRes = await resend.emails.send({
            from: "onboarding@resend.dev",
            to: targetEmail,
            replyTo: rawEmail,
            subject: `[Contact Form] ${topicLabel} from ${rawEmail}`,
            html: adminHtml,
            text: adminMail.text,
          });
          if (fallbackRes.data?.id) {
            emailStatus = "SENT";
            providerId = fallbackRes.data.id;
          } else {
            emailStatus = "FAILED";
            errorMessage = fallbackRes.error?.message || "Resend send failed.";
          }
        } else {
          emailStatus = "FAILED";
          errorMessage = res.error.message;
        }
      } else if (res.data?.id) {
        emailStatus = "SENT";
        providerId = res.data.id;
      }

      // Also attempt to send confirmation receipt to user
      try {
        await resend.emails.send({
          from: fromAddress,
          to: rawEmail,
          subject: `Received: ${topicLabel} — The Launch Feed`,
          html: userReceipt.html,
          text: userReceipt.text,
        });
      } catch (receiptErr: any) {
        console.warn("[contact] user receipt send error:", receiptErr?.message || receiptErr);
      }
    } catch (err: any) {
      emailStatus = "FAILED";
      errorMessage = err?.message || "Unknown mail error";
      console.warn("[contact] Resend request caught exception:", errorMessage);
    }
  }

  // Always record into EmailLog so admins can inspect in dashboard (with retry on cold connection)
  const logData = {
    // toEmail records the SENDER so per-sender rate limits (see the counts
    // at the top of this function) actually match, and the admin inbox stays
    // findable via meta.adminTarget.
    toEmail: rawEmail,
    templateId: "contact-form",
    subject,
    html: adminHtml,
    status: emailStatus,
    provider: "resend",
    providerId,
    errorMessage,
    triggerEvent: "contact_form",
    meta: {
      senderName: rawName || null,
      senderEmail: rawEmail,
      adminTarget: targetEmail,
      topic,
      topicLabel,
      message,
    },
  };

  try {
    await prisma.emailLog.create({ data: logData });
  } catch (dbErr: any) {
    console.warn("[contact] initial email log failed, retrying once:", dbErr?.message);
    try {
      await prisma.emailLog.create({ data: logData });
    } catch (retryErr) {
      console.error("[contact] failed to log email in DB after retry:", retryErr);
    }
  }

  return {
    success: true,
    message: "Inquiry dispatched successfully! We will get back to you within 24 hours.",
  };
}
