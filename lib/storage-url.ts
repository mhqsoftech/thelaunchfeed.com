/**
 * Pure URL helpers for the Neon Object Storage bucket. This file has NO
 * server-only dependencies (no AWS SDK, no S3 client) and is safe to import
 * from client components.
 */
const DEFAULT_STORAGE_URL =
  "https://br-frosty-moon-ayumx59h.storage.c-5.us-east-2.aws.neon.tech/thelaunchfeed";

export function getNeonStorageUrl(key: string): string {
  const cleanKey = key.replace(/^\/+/, "");
  const baseBucketUrl =
    process.env.NEXT_PUBLIC_STORAGE_BUCKET_URL || DEFAULT_STORAGE_URL;
  return `${baseBucketUrl.replace(/\/+$/, "")}/${cleanKey}`;
}
