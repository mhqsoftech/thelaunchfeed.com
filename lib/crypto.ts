import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

/**
 * AES-256-GCM helpers for third-party secrets (payment provider API keys).
 *
 * Envelope format (current):  enc:v2:<iv>.<tag>.<ciphertext>   (base64 parts)
 *   - always encrypted — nothing is ever passed through as "already encrypted"
 *   - optional AAD binds a ciphertext to its owner + provider, so a stored
 *     value copied onto another account fails authentication on decrypt
 * Legacy formats still readable: v1 "<iv>.<tag>.<ct>" (no prefix, no AAD) and
 * plaintext rows written before encryption existed. Callers re-encrypt those.
 */

const V2 = "enc:v2:";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length === 32) return buf;
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string, aad?: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(payload: string, aad?: string): string {
  const key = getKey();
  const [iv, tag, enc] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key, iv);
  if (aad) d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

/** Legacy v1 envelope shape (no prefix). */
export function isEncryptedToken(payload: string): boolean {
  if (!payload || typeof payload !== "string") return false;
  if (payload.startsWith(V2)) return true;
  const parts = payload.split(".");
  return parts.length === 3 && parts.every((p) => /^[A-Za-z0-9+/]+=*$/.test(p));
}

/** Context string binding a payment key to its owner and provider. */
export function paymentKeyAad(userId: string, provider: string) {
  return `revenue-connection:${userId}:${provider}`;
}

export function encryptPaymentApiKey(apiKey: string, aad?: string): string {
  const k = (apiKey || "").trim();
  if (!k) throw new Error("Cannot store an empty API key");
  return V2 + encryptToken(k, aad);
}

export function decryptPaymentApiKey(stored: string, aad?: string): string {
  if (!stored || stored.trim() === "") return "";
  try {
    if (stored.startsWith(V2)) return decryptToken(stored.slice(V2.length), aad);
    if (isEncryptedToken(stored)) {
      try {
        return decryptToken(stored); // legacy v1 (no AAD)
      } catch (err) {
        // A JWT-shaped key (e.g. Lemon Squeezy) stored as plaintext by the old
        // wrapper looks like a v1 envelope but isn't one.
        if (/^eyJ/.test(stored)) return stored;
        throw err;
      }
    }
    return stored; // legacy plaintext row
  } catch (err) {
    console.error("Failed to decrypt payment API key:", err instanceof Error ? err.message : err);
    throw new Error("Payment API key could not be decrypted. TOKEN_ENCRYPTION_KEY may have rotated or the stored value is corrupted.");
  }
}

/** True for rows written before the v2 envelope — re-encrypt on next use. */
export function needsReencryption(stored: string): boolean {
  return !!stored && !stored.startsWith(V2);
}

/** "rk_live_51Hx…9fQ2" — safe to show; never enough to use the key. */
export function maskSecret(secret: string): string {
  const s = (secret || "").trim();
  if (!s) return "";
  // "public_id:secret" credentials (Razorpay, Chargebee, FastSpring): show only the first part.
  if (s.includes(":")) return `${s.split(":")[0].slice(0, 24)}:••••`;
  if (s.length <= 10) return `${s.slice(0, 2)}…`;
  const prefix = s.match(/^[a-z]+_(live|test)_|^[a-z]+_[a-z]+_|^[A-Za-z]{2,5}[-_]/)?.[0] ?? s.slice(0, 4);
  return `${prefix}…${s.slice(-4)}`;
}
