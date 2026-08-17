"use server";

import { z } from "zod";
import { Resend } from "resend";
import { prisma } from "@/lib/db";

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

  const { name, email, topic, message } = parsed.data;
  const topicLabel = TOPIC_LABELS[topic] || topic;
  const subject = `[Contact Form] ${topicLabel} — ${name || email}`;
  const timestamp = new Date().toISOString();

  // 1. Admin / Desk Notification Email Template (Clean Light Theme)
  const adminHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The Launch Feed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#0a0a0a;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">New contact submission from ${name || email} (${topicLabel})</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:36px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e5e2;text-align:left;">
          <!-- Header -->
          <tr>
            <td style="padding:18px 24px;border-bottom:1px solid #e5e5e2;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="font-size:12px;font-weight:700;letter-spacing:.04em;color:#0a0a0a;">
                    <span style="display:inline-block;width:8px;height:8px;background:#D6002A;border-radius:50%;vertical-align:middle;margin-right:8px;"></span>
                    THE LAUNCH FEED
                  </td>
                  <td align="right" style="font-size:10px;text-transform:uppercase;color:#5f5f5c;font-weight:700;letter-spacing:.05em;">
                    DISPATCH
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 24px;">
              <div style="font-size:18px;font-weight:700;color:#0a0a0a;margin-bottom:16px;">
                ${topicLabel}
              </div>

              <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:12px;">
                <tr>
                  <td style="padding:6px 0;color:#5f5f5c;width:100px;text-transform:uppercase;font-size:10px;font-weight:700;">From:</td>
                  <td style="padding:6px 0;color:#0a0a0a;font-weight:700;">${name ? `${name} &lt;<a href="mailto:${email}" style="color:#D6002A;text-decoration:none;">${email}</a>&gt;` : `<a href="mailto:${email}" style="color:#D6002A;text-decoration:none;">${email}</a>`}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#5f5f5c;width:100px;text-transform:uppercase;font-size:10px;font-weight:700;">Topic:</td>
                  <td style="padding:6px 0;color:#0a0a0a;">${topicLabel} (${topic})</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;color:#5f5f5c;width:100px;text-transform:uppercase;font-size:10px;font-weight:700;">Time:</td>
                  <td style="padding:6px 0;color:#5f5f5c;">${timestamp}</td>
                </tr>
              </table>

              <div style="border:1px solid #e5e5e2;background:#fafaf8;padding:16px;margin-bottom:20px;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#5f5f5c;font-weight:700;margin-bottom:8px;">
                  MESSAGE BODY
                </div>
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#2b2b28;white-space:pre-wrap;word-break:break-word;">
${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                </div>
              </div>

              <p style="font-size:11px;line-height:1.5;color:#7a7a75;margin:0;">
                To reply directly to this sender, reply to this email (Reply-To: ${email}).
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e5e2;font-size:10px;color:#7a7a75;text-transform:uppercase;line-height:1.6;background:#fafaf8;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <a href="https://thelaunchfeed.com" style="color:#0a0a0a;font-weight:700;text-decoration:none;">thelaunchfeed.com</a> ·
                    <a href="mailto:hi@thelaunchfeed.com" style="color:#0a0a0a;text-decoration:none;">hi@thelaunchfeed.com</a>
                  </td>
                  <td align="right" style="color:#8a8a85;">
                    ADMIN DESK
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // 2. User Receipt Confirmation Email Template (Clean Light Theme)
  const userReceiptHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>The Launch Feed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#0a0a0a;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">We received your message regarding ${topicLabel} — The Launch Feed</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:36px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid #e5e5e2;text-align:left;">
          <!-- Header -->
          <tr>
            <td style="padding:18px 24px;border-bottom:1px solid #e5e5e2;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="font-size:12px;font-weight:700;letter-spacing:.04em;color:#0a0a0a;">
                    <span style="display:inline-block;width:8px;height:8px;background:#D6002A;border-radius:50%;vertical-align:middle;margin-right:8px;"></span>
                    THE LAUNCH FEED
                  </td>
                  <td align="right" style="font-size:10px;text-transform:uppercase;color:#5f5f5c;font-weight:700;letter-spacing:.05em;">
                    RECEIPT
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 24px;">
              <div style="font-size:18px;font-weight:700;color:#0a0a0a;margin-bottom:8px;">
                We received your message
              </div>
              <p style="font-size:13px;line-height:1.6;color:#4a4a46;margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
                Thank you for reaching out${name ? `, ${name}` : ""}. Our team has received your message regarding <strong>${topicLabel}</strong> and will review and reply within 24 hours.
              </p>

              <div style="border:1px solid #e5e5e2;background:#fafaf8;padding:16px;margin-bottom:20px;">
                <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#5f5f5c;font-weight:700;margin-bottom:8px;">
                  SUMMARY OF YOUR INQUIRY
                </div>
                <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#2b2b28;white-space:pre-wrap;word-break:break-word;">
${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
                </div>
              </div>

              <div style="font-size:12px;color:#5f5f5c;line-height:1.55;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
                If you need to add anything further, you can simply reply to this email or reach our official inbox at <a href="mailto:hi@thelaunchfeed.com" style="color:#D6002A;text-decoration:none;font-weight:600;">hi@thelaunchfeed.com</a>.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e5e2;font-size:10px;color:#7a7a75;text-transform:uppercase;line-height:1.6;background:#fafaf8;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <a href="https://thelaunchfeed.com" style="color:#0a0a0a;font-weight:700;text-decoration:none;">thelaunchfeed.com</a> ·
                    <a href="mailto:hi@thelaunchfeed.com" style="color:#0a0a0a;text-decoration:none;">hi@thelaunchfeed.com</a>
                  </td>
                  <td align="right" style="color:#8a8a85;">
                    DIRECT DESK
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

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
        replyTo: email,
        subject,
        html: adminHtml,
      });

      if (res.error) {
        console.warn("[contact] primary Resend send returned error:", res.error.message);
        if (res.error.name === "validation_error" || res.error.message?.includes("domain")) {
          const fallbackRes = await resend.emails.send({
            from: "onboarding@resend.dev",
            to: targetEmail,
            replyTo: email,
            subject: `[Contact Form] ${topicLabel} from ${email}`,
            html: adminHtml,
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
          to: email,
          subject: `Received: ${topicLabel} — The Launch Feed`,
          html: userReceiptHtml,
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
    toEmail: targetEmail,
    templateId: "contact_dispatch",
    subject,
    html: adminHtml,
    status: emailStatus,
    provider: "resend",
    providerId,
    errorMessage,
    triggerEvent: "contact_form",
    meta: {
      senderName: name || null,
      senderEmail: email,
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
