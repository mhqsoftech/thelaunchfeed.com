import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import { prisma } from "./db";
import { renderEmail, type RenderedEmail } from "./email/layout";

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

async function sendMail(to: string, subject: string, mail: RenderedEmail) {
  if (!resend) {
    console.warn(`[mail:dev] to=${to} subject=${subject}\n${mail.text}`);
    return;
  }
  const { error } = await resend.emails.send({ from: EMAIL_FROM, to, subject, html: mail.html, text: mail.text });
  if (error) console.error("[mail] resend error:", error);
}

function otpEmail(otp: string, kind: string): RenderedEmail {
  const heading =
    kind === "sign-in"
      ? "Your sign-in code"
      : kind === "forget-password"
        ? "Reset your password"
        : kind === "change-email"
          ? "Confirm your new email"
          : "Verify your email";

  return renderEmail({
    preheader: `${otp} is your verification code for The Launch Feed`,
    eyebrow: "Security code",
    eyebrowTone: "neutral",
    heading,
    intro: ["Enter this 6-digit code on The Launch Feed to continue:"],
    code: { value: otp, caption: "Valid for 5 minutes. Never share it with anyone." },
    outro: ["If you didn't request this code, you can safely ignore this email. Your account stays as it is."],
    reason: "You're receiving this because someone entered this address on The Launch Feed's sign-in page.",
  });
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
        renderEmail({
          preheader: "Reset your Launch Feed password. The link expires in 1 hour.",
          eyebrow: "Password reset",
          eyebrowTone: "neutral",
          heading: "Reset your password",
          intro: ["We got a request to reset the password for your Launch Feed account. The link below expires in 1 hour."],
          cta: { label: "Reset password", url },
          outro: ["If you didn't ask for this, ignore this email. Your password won't change."],
          reason: "You're receiving this because a password reset was requested for this address on The Launch Feed.",
        }),
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
          // Welcome email runs as a background job; the job respects the
          // admin's "welcome" automation toggle.
          const { emit } = await import("@/lib/jobs");
          await emit("email.send.requested", {
            templateId: "welcome",
            to: user.email,
            toUserId: user.id,
            vars: { userName: user.name || user.email, userEmail: user.email },
            trigger: "on-signup",
          });
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
