import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
for (const candidate of [
  resolve(process.cwd(), ".env"),
  resolve(process.cwd(), "../../.env"),
]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const commonEnvironment = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_PUBLIC_URL: z.string().url(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_BUCKET: z.string().min(3),
  S3_ACCESS_KEY: z.string().min(8),
  S3_SECRET_KEY: z.string().min(16),
});

const parsed = commonEnvironment.safeParse(process.env);
if (!parsed.success && process.env.NODE_ENV === "production") {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`[startup] Invalid production environment: ${details}`);
}

if (parsed.success && parsed.data.NODE_ENV === "production") {
  if (new URL(parsed.data.WEB_ORIGIN).protocol !== "https:")
    throw new Error("[startup] WEB_ORIGIN must use HTTPS in production");
  if (new URL(parsed.data.S3_PUBLIC_URL).protocol !== "https:")
    throw new Error("[startup] S3_PUBLIC_URL must use HTTPS in production");
}
