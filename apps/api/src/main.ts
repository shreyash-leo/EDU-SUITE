import "./env";
import "reflect-metadata";
import {
  All,
  BadRequestException,
  Body,
  Controller,
  HttpException,
  Module,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SwaggerModule } from "@nestjs/swagger";
import type { Request, Response } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "./password";
import { z, ZodError } from "zod";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { AppService, Actor, passwordSchema } from "./service";
import { audit, db, json } from "./store";
const service = new AppService();
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Host-plan_session"
    : "plan_session";
const attempts = new Map<string, { count: number; reset: number }>();
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
});
type Authed = Request & { actor: Actor };
async function createSession(res: Response, userId: string) {
  const raw = randomBytes(32).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  await db.session.create({
    data: {
      id: hash(raw),
      userId,
      csrf,
      expiresAt: new Date(Date.now() + 8 * 3600000),
    },
  });
  res.cookie(cookieName, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 3600000,
  });
  return csrf;
}
async function login(req: Request, res: Response, body: unknown) {
  const { email, password, portal } = z
    .object({
      email: z
        .string()
        .email()
        .transform((s) => s.toLowerCase()),
      password: z.string().max(128),
      portal: z.enum(["platform", "organization"]),
    })
    .parse(body);
  const key = req.ip || "unknown";
  const now = Date.now();
  for (const [k, v] of attempts) if (v.reset < now) attempts.delete(k);
  const attempt = attempts.get(key) || { count: 0, reset: now + 15 * 60000 };
  if (attempt.count >= 10)
    throw new HttpException(
      "Too many login attempts. Try again in 15 minutes.",
      429,
    );
  attempt.count++;
  attempts.set(key, attempt);
  const user = await db.user.findUnique({
    where: { email },
    include: { organization: true },
  });
  const valid = user
    ? await argon2.verify(user.passwordHash, password)
    : await argon2
        .verify(
          "$argon2id$v=19$m=65536,t=3,p=4$ZHVtbXlTYWx0MTIzNDU2Nw$As6D+HbRZtZyBNO4AV+YM2QwksO8FnjYkHHKYpKgTTE",
          password,
        )
        .catch(() => false);
  if (
    !user ||
    !valid ||
    user.role !== (portal === "platform" ? "PLATFORM_ADMIN" : "ORG_ADMIN") ||
    (user.organization && user.organization.status !== "ACTIVE")
  )
    throw new UnauthorizedException(
      "Invalid credentials or account unavailable",
    );
  attempts.delete(key);
  const csrf = await createSession(res, user.id);
  await audit(db, user, "auth.login", user.id);
  return {
    csrf,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      mustChangePassword: user.mustChangePassword,
    },
  };
}
async function authenticate(req: Request) {
  const token = req.cookies?.[cookieName];
  if (!token) throw new UnauthorizedException();
  const session = await db.session.findUnique({
    where: { id: hash(token) },
    include: { user: { include: { organization: true } } },
  });
  if (
    !session ||
    session.expiresAt < new Date() ||
    (session.user.organization && session.user.organization.status !== "ACTIVE")
  )
    throw new UnauthorizedException("Session expired");
  if (
    !["GET", "HEAD"].includes(req.method) &&
    req.headers["x-csrf-token"] !== session.csrf
  )
    throw new HttpException("Invalid security token. Reload and retry.", 403);
  return session;
}
const ROUTES: [string, string, string][] = [
  [
    "POST",
    "/organizations/bulk-status",
    "Transactional organization bulk status",
  ],
  [
    "POST",
    "/institutions/bulk-status",
    "Transactional institution bulk status",
  ],
  ["GET", "/settings", "Platform settings"],
  ["PUT", "/settings", "Update platform settings"],
  ["GET", "/workspace-settings", "Organization support information"],
  ["GET", "/organization-profile", "Current organization registration and contract allowances"],
  ["GET", "/onboarding", "Onboarding progress and blocking issues"],
  ["GET", "/dashboard", "Dashboard counts"],
  ["GET", "/organizations", "List organizations"],
  ["POST", "/organizations", "Create organization"],
  ["PUT", "/organizations/{id}", "Update organization"],
  ["POST", "/organizations/{id}/status", "Set organization status"],
  ["POST", "/organizations/{id}/onboarding", "Complete onboarding step"],
  ["POST", "/organizations/{id}/activate", "Activate client"],
  ["POST", "/organizations/{id}/regenerate", "Regenerate credentials"],
  ["GET", "/institutions", "List institutions"],
  ["POST", "/institutions", "Create institution"],
  ["PUT", "/institutions/{id}", "Update institution"],
  ["POST", "/institutions/{id}/action", "Institution lifecycle action"],
  ["GET", "/subscriptions", "List subscriptions"],
  ["POST", "/subscriptions", "Create subscription"],
  ["PUT", "/subscriptions/{id}", "Update subscription"],
  ["GET", "/institutions/{id}/years", "List academic years"],
  ["POST", "/institutions/{id}/years", "Create academic year"],
  ["GET", "/years/{id}/config", "Read configuration"],
  ["PUT", "/years/{id}/config", "Save draft with optimistic lock"],
  ["POST", "/years/{id}/draft", "Create working draft or restore version"],
  ["DELETE", "/years/{id}/draft", "Discard draft"],
  ["GET", "/years/{id}/review", "Review structure"],
  ["POST", "/years/{id}/calendar-summary", "Scoped academic calendar totals and holiday dates"],
  ["POST", "/years/{id}/preview", "Resolve draft calendar with centralized backend rules"],
  ["POST", "/years/{id}/publish", "Publish reviewed draft"],
  ["GET", "/years/{id}/history", "List published versions"],
  ["GET", "/requests", "List change requests"],
  ["POST", "/requests", "Submit change request"],
  ["POST", "/requests/{id}/resolve", "Resolve request"],
  ["GET", "/audit", "Read audit history"],
  ["GET", "/usage", "Read organization-wide allowance and institution utilization"],
];
@Controller("api")
class ApiController {
  @All("{*path}") async handle(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: unknown,
  ) {
    res.setHeader("Cache-Control", "no-store");
    const path = req.path.replace(/^\/api/, "").replace(/\/$/, "") || "/";
    const method = req.method;
    if (path === "/health") return { ok: true };
    if (!["GET", "HEAD"].includes(method)) {
      const origin = req.headers.origin;
      if (
        !origin ||
        origin !== (process.env.WEB_ORIGIN || "http://localhost:3000")
      )
        throw new HttpException("Origin is not allowed", 403);
    }
    if (path === "/auth/login" && method === "POST")
      return login(req, res, body);
    const session = await authenticate(req);
    const a: Actor = session.user;
    if (path === "/auth/me")
      return {
        csrf: session.csrf,
        user: {
          id: a.id,
          name: session.user.name,
          email: session.user.email,
          role: a.role,
          organizationId: a.organizationId,
          mustChangePassword: a.mustChangePassword,
          organizationName: session.user.organization?.name,
        },
      };
    if (path === "/auth/logout" && method === "POST") {
      await db.session.delete({ where: { id: session.id } });
      res.clearCookie(cookieName, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
      return { ok: true };
    }
    if (path === "/auth/password" && method === "POST") {
      const data = z
        .object({
          currentPassword: z.string().max(128),
          password: passwordSchema,
        })
        .parse(body);
      if (
        !(await argon2.verify(session.user.passwordHash, data.currentPassword))
      )
        throw new BadRequestException("Current password is incorrect");
      if (data.password === data.currentPassword)
        throw new BadRequestException("Choose a different password");
      const passwordHash = await argon2.hash(data.password, {
        type: argon2.argon2id,
      });
      await db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: a.id },
          data: { passwordHash, mustChangePassword: false },
        });
        await tx.session.deleteMany({ where: { userId: a.id } });
        if (a.organizationId)
          await tx.organization.update({
            where: { id: a.organizationId },
            data: { completedSteps: [1, 2, 3, 4, 5, 6, 7], onboardingStep: 7 },
          });
        await audit(tx, a, "auth.password-changed", a.id);
      });
      return { ok: true, csrf: await createSession(res, a.id) };
    }
    if (a.mustChangePassword)
      throw new HttpException(
        "Change the temporary password before continuing",
        403,
      );
    if (path === "/assets" && method === "POST") {
      const data = z
        .object({
          mime: z.enum(["image/png", "image/jpeg", "image/webp"]),
          base64: z.string().max(2800000),
        })
        .parse(body);
      const bytes = Buffer.from(data.base64, "base64");
      if (bytes.length > 2 * 1024 * 1024)
        throw new BadRequestException("Logo must be under 2 MB");
      const valid =
        data.mime === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : data.mime === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216
            : bytes.subarray(0, 4).toString() === "RIFF" &&
              bytes.subarray(8, 12).toString() === "WEBP";
      if (!valid)
        throw new BadRequestException(
          "Image content does not match its file type",
        );
      const key = `logos/${randomBytes(24).toString("hex")}.${data.mime.split("/")[1]}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.S3_BUCKET,
          Key: key,
          Body: bytes,
          ContentType: data.mime,
        }),
      );
      return { url: `${process.env.S3_PUBLIC_URL}/${key}` };
    }
    if (path === "/organizations/bulk-status" && method === "POST")
      return service.bulkStatus(a, "organizations", body);
    if (path === "/institutions/bulk-status" && method === "POST")
      return service.bulkStatus(a, "institutions", body);
    if (path === "/settings") {
      if (method === "GET") return service.settings(a);
      if (method === "PUT") return service.saveSettings(a, body);
    }
    if (path === "/workspace-settings" && method === "GET")
      return service.publicSettings();
    if (path === "/onboarding" && method === "GET")
      return service.onboardingOverview(a);
    if (path === "/organization-profile" && method === "GET") return service.organizationProfile(a);
    if (path === "/dashboard" && method === "GET") return service.dashboard(a);
    if (path === "/organizations") {
      if (method === "GET") return service.orgs(a);
      if (method === "POST") return service.saveOrg(a, body);
    }
    let m = path.match(
      /^\/organizations\/([^/]+)(?:\/(status|onboarding|activate|regenerate))?$/,
    );
    if (m) {
      const id = z.string().uuid().parse(m[1]);
      if (!m[2] && method === "PUT") return service.saveOrg(a, body, id);
      if (m[2] && method === "POST") {
        if (m[2] === "status") return service.orgStatus(a, id, body);
        if (m[2] === "onboarding") return service.onboarding(a, id, body);
        return service.activate(a, id, m[2] === "regenerate");
      }
    }
    if (path === "/institutions") {
      if (method === "GET") return service.institutions(a);
      if (method === "POST") return service.saveInstitution(a, body);
    }
    m = path.match(/^\/institutions\/([^/]+)(?:\/(action|years))?$/);
    if (m) {
      const id = z.string().uuid().parse(m[1]);
      if (!m[2] && method === "PUT")
        return service.saveInstitution(a, body, id);
      if (m[2] === "action" && method === "POST")
        return service.institutionAction(a, id, body);
      if (m[2] === "years") {
        if (method === "GET") return service.years(a, id);
        if (method === "POST") return service.createYear(a, id, body);
      }
    }
    if (path === "/subscriptions") {
      if (method === "GET") return service.subscriptions(a);
      if (method === "POST") return service.saveSubscription(a, body);
    }
    m = path.match(/^\/subscriptions\/([^/]+)$/);
    if (m && method === "PUT")
      return service.saveSubscription(a, body, z.string().uuid().parse(m[1]));
    m = path.match(/^\/years\/([^/]+)\/(config|draft|review|publish|history|preview|calendar-summary)$/);
    if (m) {
      const id = z.string().uuid().parse(m[1]);
      if (m[2] === "config") {
        if (method === "GET")
          return service.config(
            a,
            id,
            req.query.revisionId
              ? z.string().uuid().parse(req.query.revisionId)
              : undefined,
          );
        if (method === "PUT") return service.saveConfig(a, id, body);
      }
      if (m[2] === "draft") {
        if (method === "POST") return service.draft(a, id, body);
        if (method === "DELETE") return service.discard(a, id);
      }
      if (m[2] === "calendar-summary" && method === "POST") return service.calendarSummary(a, id, body);
      if (m[2] === "preview" && method === "POST") return service.preview(a, id, body);
      if (m[2] === "review" && method === "GET") return service.review(a, id);
      if (m[2] === "publish" && method === "POST")
        return service.publish(a, id, body);
      if (m[2] === "history" && method === "GET") return service.history(a, id);
    }
    if (path === "/requests") {
      if (method === "GET") return service.requests(a);
      if (method === "POST") return service.request(a, body);
    }
    m = path.match(/^\/requests\/([^/]+)\/resolve$/);
    if (m && method === "POST")
      return service.resolveRequest(a, z.string().uuid().parse(m[1]), body);
    if (path === "/audit" && method === "GET") return service.audits(a);
    if (path === "/usage" && method === "GET") return service.usage(a);
    throw new HttpException("Endpoint not found", 404);
  }
}
@Module({ controllers: [ApiController] })
class AppModule {}
export async function reconcileDeletions(now = new Date()) {
  const pending = await db.institution.findMany({
    where: {
      status: "DELETION_PENDING",
      deletionDueAt: { lte: now },
      legalHold: false,
    },
    select: { id: true },
  });
  for (const item of pending) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Institution" WHERE id=${item.id} FOR UPDATE`;
      const i = await tx.institution.findUnique({ where: { id: item.id } });
      if (
        !i ||
        i.status !== "DELETION_PENDING" ||
        !i.deletionDueAt ||
        i.deletionDueAt > now ||
        i.legalHold
      )
        return;
      const key = i.logo.startsWith(`${process.env.S3_PUBLIC_URL}/`)
        ? i.logo.slice((process.env.S3_PUBLIC_URL || "").length + 1)
        : null;
      if (key)
        await s3.send(
          new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
        );
      await tx.changeRequest.deleteMany({ where: { institutionId: i.id } });
      await tx.institution.delete({ where: { id: i.id } });
      await audit(
        tx,
        { id: "system" },
        "institution.permanently-deleted",
        i.id,
        { retentionDays: 60 },
      );
    });
  }
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
}
async function bootstrap() {
  try {
    await db.$connect();
  } catch {
    console.error(
      "[startup] Cannot connect to PostgreSQL. Start Docker Desktop, run 'docker compose up -d --wait postgres minio', and check DATABASE_URL (local development uses localhost:55432).",
    );
    await db.$disconnect();
    process.exitCode = 1;
    return;
  }
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log"],
  });
  app.use((req: Request, res: Response, next: () => void) => {
    const started = Date.now();
    res.on("finish", () => {
      console.log(JSON.stringify({
        event: "http.request",
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - started,
        ...(res.locals.validationMessage ? { message: res.locals.validationMessage } : {}),
      }));
    });
    next();
  });
  app.use(helmet());
  app.use(cookieParser());
  app.use(require("express").json({ limit: "3mb" }));
  app.useGlobalFilters({
    catch(error: unknown, host: any) {
      const res = host.switchToHttp().getResponse() as Response;
      if (error instanceof ZodError) {
        res.locals.validationMessage = error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      } else if (error instanceof HttpException && error.getStatus() === 400) {
        res.locals.validationMessage = error.message;
      }
      if (error instanceof ZodError)
        return res.status(400).json({
          message: error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        });
      if (error instanceof HttpException)
        return res
          .status(error.getStatus())
          .json(
            typeof error.getResponse() === "string"
              ? { message: error.getResponse() }
              : error.getResponse(),
          );
      const code = (error as { code?: string }).code;
      if (code === "P2002")
        return res
          .status(409)
          .json({ message: "A record with this unique value already exists" });
      if (code === "P2025")
        return res.status(404).json({ message: "Record not found" });
      console.error(
        JSON.stringify({
          level: "error",
          event: "request.failed",
          name: (error as Error).name,
          message: (error as Error).message,
        }),
      );
      return res
        .status(500)
        .json({ message: "The operation could not be completed. Try again." });
    },
  });
  const paths: Record<string, any> = {};
  for (const [method, path, summary] of ROUTES) {
    const full = "/api" + path;
    paths[full] ||= {};
    paths[full][method.toLowerCase()] = {
      summary,
      security: [{ cookieAuth: [] }],
      parameters: [
        ...Array.from(path.matchAll(/\{([^}]+)\}/g)).map((m) => ({
          in: "path",
          name: m[1],
          required: true,
          schema: { type: "string", format: "uuid" },
        })),
        ...(!["GET", "HEAD"].includes(method)
          ? [
              {
                in: "header",
                name: "x-csrf-token",
                required: true,
                schema: { type: "string" },
              },
            ]
          : []),
      ],
      responses: {
        200: { description: "Success" },
        400: { description: "Validation error" },
        401: { description: "Unauthenticated" },
        403: { description: "Forbidden" },
        409: { description: "Conflict" },
      },
      ...(!["GET", "DELETE"].includes(method)
        ? {
            requestBody: {
              required: true,
              content: { "application/json": { schema: { type: "object" } } },
            },
          }
        : {}),
    };
  }
  SwaggerModule.setup("api/docs", app, {
    openapi: "3.0.0",
    info: {
      title: "PLAN EDU SUITE",
      version: "1.0.0",
      description:
        "Session cookie authentication; use /api/auth/login, then x-csrf-token for writes. See API.md for request schemas.",
    },
    paths,
    components: {
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: cookieName },
      },
    },
  });
  await app.listen(Number(process.env.API_PORT || 4000), "0.0.0.0");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await reconcileDeletions();
    } catch (e) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "deletion.reconciliation-failed",
          message: (e as Error).message,
        }),
      );
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), 60000);
  timer.unref();
  const shutdown = async () => {
    clearInterval(timer);
    await app.close();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}
if (process.env.NODE_ENV !== "test") void bootstrap();
