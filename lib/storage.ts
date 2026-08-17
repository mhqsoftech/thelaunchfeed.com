import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

/**
 * Neon Object Storage S3 Client configuration
 */
const endpoint = process.env.AWS_ENDPOINT_URL_S3;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION || "us-east-2";

if (!endpoint || !accessKeyId || !secretAccessKey) {
  console.warn(
    "[s3-storage] Warning: Missing S3 environment variables (AWS_ENDPOINT_URL_S3, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY)."
  );
}

export const s3Client = new S3Client({
  endpoint,
  region,
  credentials: {
    accessKeyId: accessKeyId || "",
    secretAccessKey: secretAccessKey || "",
  },
  forcePathStyle: true, // Necessary for many custom S3 compatible providers like Neon / MinIO
});

/**
 * Uploads a file Buffer or Uint8Array to Neon Object Storage bucket and returns its public URL.
 * 
 * @param buffer - File data to upload
 * @param key - Destination object key/path in the bucket (e.g. `avatars/user-123.webp` or `logos/prod-456.png`)
 * @param contentType - MIME type of the file (e.g. `image/png`, `image/webp`)
 * @returns Public URL of the uploaded image
 */
export async function uploadToNeonStorage(
  buffer: Buffer | Uint8Array,
  key: string,
  contentType: string
): Promise<string> {
  const bucketName = process.env.AWS_S3_BUCKET_NAME || "launchfeed-assets";

  // Sanitize key (remove leading slash if present)
  const cleanKey = key.replace(/^\/+/, "");

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cleanKey,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Construct public URL.
  // Neon S3 endpoint: https://<endpoint>/<bucket>/<key> or direct public URL structure
  const baseEndpoint = endpoint?.endsWith("/") ? endpoint.slice(0, -1) : endpoint;
  return `${baseEndpoint}/${bucketName}/${cleanKey}`;
}

const DEFAULT_STORAGE_URL = "https://br-frosty-moon-ayumx59h.storage.c-5.us-east-2.aws.neon.tech/thelaunchfeed";

/**
 * Returns the public URL for a key stored in the Neon Object Storage bucket.
 */
export function getNeonStorageUrl(key: string): string {
  const cleanKey = key.replace(/^\/+/, "");
  const baseBucketUrl =
    process.env.NEXT_PUBLIC_STORAGE_BUCKET_URL ||
    (endpoint
      ? `${endpoint.replace(/\/+$/, "")}/${process.env.AWS_S3_BUCKET_NAME || "thelaunchfeed"}`
      : DEFAULT_STORAGE_URL);
  return `${baseBucketUrl.replace(/\/+$/, "")}/${cleanKey}`;
}

/**
 * Parses a Data URI string (e.g. `data:image/png;base64,...`) into a Buffer and content-type.
 */
export function parseDataUri(dataUri: string): { buffer: Buffer; contentType: string } | null {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const contentType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  return { buffer, contentType };
}
