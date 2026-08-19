import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length === 32) return buf;
  return createHash("sha256").update(raw).digest();
}

export function encryptToken(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(".");
}

export function decryptToken(payload: string): string {
  const key = getKey();
  const [iv, tag, enc] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export function isEncryptedToken(payload: string): boolean {
  if (!payload || typeof payload !== "string") return false;
  const parts = payload.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

export function encryptPaymentApiKey(apiKey: string): string {
  if (!apiKey || apiKey.trim() === "") return "";
  if (isEncryptedToken(apiKey)) return apiKey;
  return encryptToken(apiKey);
}

export function decryptPaymentApiKey(encryptedKey: string): string {
  if (!encryptedKey || encryptedKey.trim() === "") return "";
  if (!isEncryptedToken(encryptedKey)) {
    // Not our envelope — assume plaintext (legacy row written before encryption).
    return encryptedKey;
  }
  try {
    return decryptToken(encryptedKey);
  } catch (err) {
    // Fail loud. The previous fallback returned the *ciphertext*, which then
    // got sent to Stripe/Paddle as the API key and produced cryptic 401s that
    // masked the real cause (rotated TOKEN_ENCRYPTION_KEY, corruption, tag
    // mismatch). Throw so the caller can surface a real error to the admin.
    console.error("Failed to decrypt payment API key:", err);
    throw new Error(
      "Payment API key could not be decrypted. TOKEN_ENCRYPTION_KEY may have rotated or the stored value is corrupted."
    );
  }
}


