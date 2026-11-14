import "../apps/api/src/env";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hash, verify } from "../apps/api/src/password";

const db = new PrismaClient();

async function main() {
  const database = new URL(process.env.DATABASE_URL || "");
  if (
    process.env.NODE_ENV === "production" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(database.hostname)
  ) {
    throw new Error("This recovery command is only for a local development database.");
  }
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("Set SEED_ADMIN_EMAIL in .env first.");
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error("Set SEED_ADMIN_PASSWORD in .env to a password between 12 and 128 characters.");
  }
  const passwordHash = await hash(password);
  await db.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing && (existing.role !== "PLATFORM_ADMIN" || existing.organizationId)) {
      throw new Error("The configured email belongs to an organization account. Recovery stopped.");
    }
    if (existing) {
      await tx.user.update({
        where: { id: existing.id },
        data: { passwordHash, mustChangePassword: false },
      });
      await tx.session.deleteMany({ where: { userId: existing.id } });
    } else {
      await tx.user.create({
        data: {
          email,
          name: "Platform Administrator",
          role: "PLATFORM_ADMIN",
          passwordHash,
          mustChangePassword: false,
        },
      });
    }
  });
  const account = await db.user.findUniqueOrThrow({ where: { email } });
  if (!(await verify(account.passwordHash, password))) {
    throw new Error("Password verification failed after reset.");
  }
  console.log(`\nSuper Admin login: ${email}\nPassword restored from SEED_ADMIN_PASSWORD in .env.\nSign in using those .env credentials. No password change is required for this local account.\n`);
  console.log("Database password verification: PASSED");
  try {
    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({ email, password, portal: "platform" }),
      signal: AbortSignal.timeout(10000),
      redirect: "error",
    });
    if (response.ok) {
      console.log("Website login verification: PASSED. These credentials work through localhost:3000.");
      // Remove only the session created by this diagnostic login.
      const cookie = response.headers.get("set-cookie");
      const token = cookie?.match(/(?:^|,\s*)(?:__Host-)?plan_session=([^;]+)/)?.[1];
      if (token) {
        await db.session.deleteMany({
          where: { id: createHash("sha256").update(token).digest("hex") },
        });
      }
    } else if (response.status === 401) {
      console.log("Website login verification: FAILED (401). The running website rejected the password verified in this database. Check its API process, DATABASE_URL and API_INTERNAL_URL.");
    } else if (response.status === 429) {
      console.log("Website login verification: RATE LIMITED. Restart npm run dev to clear the local login attempt limit.");
    } else if (response.status === 403) {
      console.log("Website login verification: BLOCKED BY ORIGIN CHECK. For localhost development, set WEB_ORIGIN=http://localhost:3000 in .env and restart npm run dev.");
    } else {
      console.log(`Website login verification: HTTP ${response.status}. Check the running API logs.`);
    }
  } catch {
    console.log("Website login verification: UNAVAILABLE. Start npm run dev, then rerun this command to check the website.");
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Local administrator recovery failed.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
