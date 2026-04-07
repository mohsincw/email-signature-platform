import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.S3_ENDPOINT ?? "http://localhost:9000";
const region = process.env.S3_REGION ?? "us-east-1";
const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "minioadmin";
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "minioadmin";

export const s3Bucket = process.env.S3_BUCKET ?? "signatures";
export const s3PublicUrl =
  process.env.S3_PUBLIC_URL ?? "http://localhost:9000/signatures";

export const s3Client = new S3Client({
  endpoint,
  region,
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

export async function createPresignedUploadUrl(
  key: string,
  contentType = "image/png"
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 60 * 5 });
}
