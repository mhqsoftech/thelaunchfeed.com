import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import { prisma } from "./db";

/**
 * Local Better Auth instance backed by Prisma/Postgres (Neon).
 *
 * All /api/auth/* routes are served by the toNextJsHandler over this
 * config. Sessions live in the `Session` table, credentials in `Account`,
 * OTPs in `Verification`. There is no external auth server.
 */

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || "The Launch Feed <hi@thelaunchfeed.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function sendMail(to: string, subject: string, html: string) {
  if (!resend) {
    console.warn(`[mail:dev] to=${to} subject=${subject}\n${html}`);
    return;
  }
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
  if (error) console.error("[mail] resend error:", error);
}

function otpEmail(otp: string, kind: string) {
  const heading =
    kind === "sign-in"
      ? "Your sign-in code"
      : kind === "forget-password"
        ? "Reset your password"
        : kind === "change-email"
          ? "Confirm your new email"
          : "Verify your email";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>The Launch Feed</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f2;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#0a0a0a;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${otp} is your verification code for The Launch Feed</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:36px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:1px solid #e5e5e2;text-align:left;">
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
                    AUTH CODE
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 24px;">
              <div style="font-size:18px;font-weight:700;color:#0a0a0a;margin-bottom:8px;">
                ${heading}
              </div>
              <p style="font-size:13px;line-height:1.6;color:#4a4a46;margin:0 0 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
                Enter this 6-digit one-time code to authenticate your session on <strong>The Launch Feed</strong>:
              </p>

              <!-- Code Box -->
              <div style="background:#fafaf8;border:1px solid #e5e5e2;padding:20px;text-align:center;margin-bottom:20px;">
                <div style="font-size:32px;font-weight:800;letter-spacing:.32em;color:#0a0a0a;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;padding-left:.32em;">
                  ${otp}
                </div>
                <div style="font-size:11px;color:#5f5f5c;margin-top:10px;font-weight:600;letter-spacing:.02em;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Valid for 5 minutes only
                </div>
              </div>

              <p style="font-size:12px;line-height:1.55;color:#7a7a75;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;">
                If you did not request this verification code, you can safely ignore this email. No action is required.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:16px 24px;border-top:1px solid #e5e5e2;font-size:10px;color:#7a7a75;text-transform:uppercase;line-height:1.6;background:#fafaf8;">
              <table role="presentation" width="100%">
                <tr>
                  <td>
                    <a href="${APP_URL}" style="color:#0a0a0a;font-weight:700;text-decoration:none;">thelaunchfeed.com</a> ·
                    <a href="mailto:hi@thelaunchfeed.com" style="color:#0a0a0a;text-decoration:none;">hi@thelaunchfeed.com</a>
                  </td>
                  <td align="right" style="color:#8a8a85;">
                    SECURE SIGN-IN
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
}

const isAdmin = (email: string) => {
  const admin = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  return !!admin && email.trim().toLowerCase() === admin;
};

function slugifyUsername(seed: string): string {
  const base = seed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  return base || `u_${Math.random().toString(36).slice(2, 8)}`;
}

async function pickUniqueUsername(seed: string): Promise<string> {
  const base = slugifyUsername(seed);
  let candidate = base;
  for (let i = 0; i < 6; i++) {
    const clash = await prisma.user.findUnique({ where: { username: candidate } }).catch(() => null);
    if (!clash) return candidate;
    candidate = `${base}_${Math.floor(Math.random() * 9000) + 1000}`;
  }
  return `${base}_${Date.now().toString(36).slice(-4)}`;
}

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : undefined;
const github =
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? { clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET }
    : undefined;

export const auth = betterAuth({
  appName: "The Launch Feed",
  baseURL: APP_URL,
  secret: process.env.APP_SECRET || "dev-secret-change-in-production",
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
    // Email verification is enforced via the emailOTP plugin's
    // sendVerificationOnSignUp; users can still sign in and verify after.
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      await sendMail(
        user.email,
        "Reset your Launch Feed password",
        `<p>Click below to reset your password. This link expires in 1 hour.</p><p><a href="${url}">${url}</a></p>`,
      );
    },
  },

  socialProviders: {
    ...(google ? { google } : {}),
    ...(github ? { github } : {}),
  },

  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
      websiteUrl: { type: "string", required: false, input: false },
      twitterHandle: { type: "string", required: false, input: false },
      githubHandle: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false, defaultValue: "MAKER" },
      isProfilePublic: { type: "boolean", required: false, input: false, defaultValue: true },
      showRevenuePublic: { type: "boolean", required: false, input: false, defaultValue: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const seed = user.name || user.email.split("@")[0] || "user";
          const username = await pickUniqueUsername(seed);
          return {
            data: {
              ...user,
              name: user.name || seed,
              username,
              role: isAdmin(user.email) ? "ADMIN" : "MAKER",
            },
          };
        },
        after: async (user) => {
          // Fire the welcome email. We call sendAndLog directly (in-process)
          // rather than dispatching through Inngest so it works in dev
          // without inngest-cli, and so a failed dispatch doesn't silently
          // eat the send. Respect the admin automation toggle for "welcome".
          try {
            const rule = await prisma.automationRule
              .findUnique({ where: { templateId: "welcome" } })
              .catch(() => null);
            if (rule && rule.enabled === false) return;

            const { sendAndLog } = await import("@/lib/inngest/functions");
            await sendAndLog({
              templateId: "welcome",
              to: user.email,
              toUserId: user.id,
              vars: { userName: user.name || user.email, userEmail: user.email },
              trigger: "on-signup",
            });
          } catch (e) {
            console.error("[welcome-email] failed:", e);
          }
        },
      },
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refresh sliding expiry once per day
    cookieCache: { enabled: false },
  },

  advanced: {
    cookiePrefix: "tlf",
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        const subject =
          type === "sign-in"
            ? `Sign-in code: ${otp}`
            : type === "forget-password"
              ? `Reset code: ${otp}`
              : `Verify your email: ${otp}`;
        await sendMail(email, subject, otpEmail(otp, type));
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
