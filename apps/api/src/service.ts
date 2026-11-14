import {
  configurationChanges,
  onboardingChecklist,
  platformSettingsSchema,
  defaultPlatformSettings,
  calendarDay,
  calendarSummary,
  selectedClassrooms,
} from "../../../packages/domain/src/enhancements";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomBytes, randomUUID } from "node:crypto";
import * as argon2 from "./password";
import { z } from "zod";
import {
  configSchema,
  boardSchema,
  copyYear,
  countClassrooms,
  deletionDue,
  emptyConfig,
  organizationCategory,
  review,
  validDate,
} from "../../../packages/domain/src";
import type { Config } from "../../../packages/domain/src";
import { db, Tx, audit, json, readConfig, writeConfig } from "./store";
import { activeContract, assertClassroomChange, lockOrganization, organizationUsage } from "./licensing";
export type Actor = {
  id: string;
  role: string;
  organizationId: string | null;
  mustChangePassword: boolean;
};
const text = z.string().trim().max(300);
const email = z
  .string()
  .email()
  .transform((s) => s.toLowerCase());
const orgSchema = z.object({
  name: text.min(1),
  legalName: text.default(""),
  type: text.default("Education trust"),
  registration: text.default(""),
  address: text.default(""),
  city: text.default(""),
  state: text.default(""),
  postalCode: text.default(""),
  contactName: text.default(""),
  phone: text.default(""),
  email,
  notes: z.string().max(5000).default(""),
});
const institutionSchema = z.object({
  name: text.min(1),
  registration: text.min(1),
  address: text.default(""),
  boards: z
    .array(text.min(1))
    .min(1)
    .max(20)
    .refine(
      (a) => new Set(a.map((v) => v.toLowerCase())).size === a.length,
      "Boards must be unique",
    ),
  logo: z.string().max(1000).default(""),
  officer: text.default(""),
  phone: text.default(""),
  email: z.union([email, z.literal("")]).default(""),
});
const subSchema = z
  .object({
    organizationId: z.string().uuid(),
    reference: text.min(1),
    amount: z.coerce.number().finite().min(0).max(1e10),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    status: z.enum(["DRAFT", "ACTIVE", "EXPIRED", "SUSPENDED"]),
    agreementStatus: z.enum(["PENDING", "SIGNED", "EXCEPTION"]),
    paymentStatus: z.enum(["PENDING", "PAID", "PARTIAL", "EXCEPTION"]),
    paymentReference: text.default(""),
    notes: z.string().max(5000).default(""),
    exceptionReason: text.default(""),
    renewalNotes: text.default(""),
    classroomLimit: z.number().int().min(0).max(100000),
    userLimit: z.number().int().min(1).max(100000),
  })
  .refine((v) => v.endsAt > v.startsAt, "Subscription end must be after start")
  .refine(
    (v) => ![v.agreementStatus, v.paymentStatus].includes("EXCEPTION") || v.exceptionReason.length >= 5,
    "Provide an exception reason",
  );
export const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .regex(/[a-z]/, "Include lowercase")
  .regex(/[A-Z]/, "Include uppercase")
  .regex(/[0-9]/, "Include a number")
  .regex(/[^a-zA-Z0-9]/, "Include a symbol");
@Injectable()
export class AppService {
  async bulkStatus(
    a: Actor,
    kind: "organizations" | "institutions",
    body: unknown,
  ) {
    this.admin(a);
    const { ids, status } = z
      .object({
        ids: z
          .array(z.string().uuid())
          .min(1)
          .max(200)
          .refine(
            (v) => new Set(v).size === v.length,
            "Duplicate record selection",
          ),
        status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
      })
      .parse(body);
    return db.$transaction(async (tx) => {
      for (const id of [...ids].sort()) {
        if (kind === "organizations")
          await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${id} FOR UPDATE`;
        else
          await tx.$queryRaw`SELECT id FROM "Institution" WHERE id=${id} FOR UPDATE`;
      }
      if (kind === "organizations") {
        const rows = await tx.organization.findMany({
          where: { id: { in: ids } },
        });
        if (rows.length !== ids.length)
          throw new NotFoundException(
            "One or more organizations are unavailable",
          );
        if (status === "ACTIVE" && rows.some((o) => !o.activatedAt))
          throw new BadRequestException(
            "Every selected organization must complete client activation before reactivation",
          );
        await tx.organization.updateMany({
          where: { id: { in: ids } },
          data: { status },
        });
        await tx.session.deleteMany({
          where: { user: { organizationId: { in: ids } } },
        });
      } else {
        if (status === "SUSPENDED")
          throw new BadRequestException(
            "Use school activation or deactivation",
          );
        const rows = await tx.institution.findMany({
          where: { id: { in: ids } },
        });
        if (rows.length !== ids.length || rows.some((i) => !!i.deletionDueAt))
          throw new BadRequestException(
            "Restore schools pending deletion before changing their status",
          );
        await tx.institution.updateMany({
          where: { id: { in: ids } },
          data: { status },
        });
      }
      for (const id of ids)
        await audit(tx, a, kind + ".bulk-status", id, { status });
      return { updated: ids.length };
    });
  }
  async settings(a: Actor) {
    this.admin(a);
    const r = await db.platformSetting.findUnique({
      where: { id: "platform" },
    });
    return {
      values: r
        ? platformSettingsSchema.parse(r.values)
        : defaultPlatformSettings,
      lock: r?.lock || 0,
      updatedAt: r?.updatedAt || null,
    };
  }
  async publicSettings() {
    const r = await db.platformSetting.findUnique({
      where: { id: "platform" },
    });
    const v = r
      ? platformSettingsSchema.parse(r.values)
      : defaultPlatformSettings;
    return {
      supportEmail: v.supportEmail,
      supportPhone: v.supportPhone,
      supportNotes: v.supportNotes,
      maintenanceNotice: v.maintenanceNotice,
    };
  }
  async saveSettings(a: Actor, body: unknown) {
    this.admin(a);
    const data = z
      .object({ values: platformSettingsSchema, lock: z.number().int().min(0) })
      .parse(body);
    return db.$transaction(async (tx) => {
      await tx.platformSetting.upsert({
        where: { id: "platform" },
        create: { id: "platform", values: json(defaultPlatformSettings) },
        update: {},
      });
      const updated = await tx.platformSetting.updateMany({
        where: { id: "platform", lock: data.lock },
        data: { values: json(data.values), lock: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new ConflictException(
          "Settings changed elsewhere. Reload before saving.",
        );
      await audit(tx, a, "platform.settings-updated", "platform", data.values);
      return { values: data.values, lock: data.lock + 1 };
    });
  }
  async onboardingOverview(a: Actor) {
    this.admin(a);
    const orgs = await db.organization.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        institutions: true,
        subscriptions: true,
      },
    });
    return orgs.map((o) => {
      const checklist = onboardingChecklist(o, o.institutions, o.subscriptions);
      const outstanding = checklist.find((s) => !s.complete);
      return {
        id: o.id,
        name: o.name,
        email: o.email,
        status: o.status,
        currentStep: outstanding?.step || 7,
        progress: Math.round(
          (checklist.filter((s) => s.complete).length / 7) * 100,
        ),
        blockingIssues: outstanding?.blockers || [],
        checklist,
        updatedAt: new Date(
          Math.max(
            o.updatedAt.getTime(),
            ...o.institutions.map((i) => i.updatedAt.getTime()),
            ...o.subscriptions.map((s) => s.updatedAt.getTime()),
          ),
        ),
      };
    });
  }
  admin(a: Actor) {
    if (a.role !== "PLATFORM_ADMIN")
      throw new ForbiddenException("Super Admin access required");
  }
  async organization(a: Actor, id: string, tx: Tx = db) {
    if (a.role !== "PLATFORM_ADMIN" && a.organizationId !== id)
      throw new NotFoundException();
    return tx.organization.findUniqueOrThrow({ where: { id } });
  }
  async institution(a: Actor, id: string, tx: Tx = db) {
    const i = await tx.institution.findFirst({
      where: {
        id,
        ...(a.role === "PLATFORM_ADMIN"
          ? {}
          : {
              organizationId: a.organizationId || "denied",
              status: "ACTIVE",
              organization: { status: "ACTIVE" },
            }),
      },
      
    });
    if (!i) throw new NotFoundException("School unavailable");
    return i;
  }
  async year(a: Actor, id: string, tx: Tx = db) {
    const y = await tx.academicYear.findUnique({ where: { id } });
    if (!y) throw new NotFoundException();
    await this.institution(a, y.institutionId, tx);
    return y;
  }
  async orgs(a: Actor) {
    this.admin(a);
    return db.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { institutions: true } },
        subscriptions: { select: { status: true } },
        institutions: { select: { id: true, name: true } },
      },
    });
  }
  async dashboard(a: Actor) {
    this.admin(a);
    const rows = await this.onboardingOverview(a);
    const organizations = await this.orgs(a);
    const category = (s: string) => rows.filter((o) => organizationCategory(o.status) === s).length;
    return {
      total: rows.length, active: category("ACTIVE"), onboarding: category("ONBOARDING"), inactive: category("INACTIVE"),
      recent: [...rows].sort((a,b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0,8).map((o) => ({
        ...o, _count: organizations.find((r) => r.id === o.id)?._count,
      })),
    };
  }

  async saveOrg(a: Actor, body: unknown, id?: string) {
    this.admin(a);
    const data = orgSchema.parse(body);
    return db.$transaction(async (tx) => {
      const org = id
        ? await tx.organization.update({ where: { id }, data })
        : await tx.organization.create({ data });
      await audit(
        tx,
        a,
        id ? "organization.updated" : "organization.created",
        org.id,
      );
      return org;
    });
  }
  async orgStatus(a: Actor, id: string, body: unknown) {
    this.admin(a);
    const { status } = z
      .object({ status: z.enum(["INACTIVE", "SUSPENDED", "ACTIVE"]) })
      .parse(body);
    return db.$transaction(async (tx) => {
      const o = await tx.organization.findUniqueOrThrow({ where: { id } });
      if (status === "ACTIVE" && !o.activatedAt)
        throw new BadRequestException(
          "Complete onboarding and activate the client first",
        );
      await tx.organization.update({ where: { id }, data: { status } });
      await tx.session.deleteMany({ where: { user: { organizationId: id } } });
      await audit(tx, a, "organization.status", id, { status });
      return { ok: true };
    });
  }
  async institutions(a: Actor) {
    return db.institution.findMany({
      where:
        a.role === "PLATFORM_ADMIN"
          ? {}
          : {
              organizationId: a.organizationId || "denied",
              status: { not: "DELETION_PENDING" },
              organization: { status: "ACTIVE" },
            },
      include: {
        organization: { select: { name: true } },

        years: {
          orderBy: { startsAt: "desc" },
          select: {
            id: true,
            label: true,
            publishedRevisionId: true,
            draftRevisionId: true,
            publishedRevision: { select: { status: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
  async saveInstitution(a: Actor, body: unknown, id?: string) {
    this.admin(a);
    const { organizationId, ...data } = institutionSchema
      .extend({ organizationId: z.string().uuid() })
      .parse(body);
    await this.organization(a, organizationId);
    return db.$transaction(async (tx) => {
      await lockOrganization(tx, organizationId);
      if (id) {
        await tx.$queryRaw`SELECT id FROM "Institution" WHERE id=${id} FOR UPDATE`;
        const old = await this.institution(a, id, tx);
        if (old.organizationId !== organizationId) throw new BadRequestException("School ownership cannot change");
        if (old.deletionDueAt) throw new BadRequestException("Restore the school before editing");
        const removedBoards = old.boards.filter((b) => !data.boards.includes(b));
        if (removedBoards.length && await tx.academicYear.count({ where: { institutionId: id } }))
          throw new BadRequestException("Registered boards with academic years cannot be removed");
      }
      const result = id
        ? await tx.institution.update({ where: { id }, data })
        : await tx.institution.create({ data: { ...data, organizationId } });
      await audit(
        tx,
        a,
        id ? "institution.updated" : "institution.created",
        result.id,
      );
      return result;
    });
  }
  async institutionAction(a: Actor, id: string, body: unknown) {
    this.admin(a);
    const { action, confirmation } = z
      .object({
        action: z.enum(["deactivate", "reactivate", "delete", "restore"]),
        confirmation: z.string().optional(),
      })
      .parse(body);
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Institution" WHERE id=${id} FOR UPDATE`;
      const i = await this.institution(a, id, tx);
      let data: Prisma.InstitutionUpdateInput = {};
      if (action === "delete") {
        if (confirmation !== i.name)
          throw new BadRequestException("Type the school name to confirm");
        if (i.deletionDueAt) return i;
        data = {
          status: "DELETION_PENDING",
          preDeletionStatus: i.status,
          deletionRequestedAt: new Date(),
          deletionDueAt: deletionDue(new Date()),
        };
      } else if (action === "restore") {
        if (!i.deletionDueAt || i.deletionDueAt <= new Date())
          throw new BadRequestException("The recovery period has ended");
        data = {
          status: i.preDeletionStatus || "INACTIVE",
          deletionRequestedAt: null,
          deletionDueAt: null,
          preDeletionStatus: null,
        };
      } else {
        if (i.deletionDueAt)
          throw new BadRequestException("Restore pending deletion first");
        data = { status: action === "deactivate" ? "INACTIVE" : "ACTIVE" };
      }
      const updated = await tx.institution.update({ where: { id }, data });
      await audit(tx, a, `institution.${action}`, id, {
        deletionDueAt: updated.deletionDueAt,
      });
      return updated;
    });
  }
  async organizationProfile(a: Actor) {
    if (!a.organizationId) throw new ForbiddenException("An organization account is required");
    return db.organization.findUniqueOrThrow({ where: { id: a.organizationId },
      select: { id: true, name: true, legalName: true, registration: true, address: true, city: true, state: true, postalCode: true, contactName: true, phone: true, email: true, status: true,
        subscriptions: { select: { id: true, reference: true, status: true, startsAt: true, endsAt: true, classroomLimit: true, userLimit: true }, orderBy: { startsAt: "desc" } } } });
  }
  async subscriptions(a: Actor) {
    this.admin(a);
    return db.subscription.findMany({
      include: {
        organization: { select: { name: true } },

      },
      orderBy: { createdAt: "desc" },
    });
  }
  async saveSubscription(a: Actor, body: unknown, id?: string) {
    this.admin(a);
    const data = subSchema.parse(body);
    await this.organization(a, data.organizationId);
    return db.$transaction(async (tx) => {
      await lockOrganization(tx, data.organizationId);
      if (id) {
        const old = await tx.subscription.findUniqueOrThrow({ where: { id } });
        if (old.organizationId !== data.organizationId) throw new BadRequestException("Subscription ownership cannot change");
      }
      if (data.status === "ACTIVE") {
        const overlap = await tx.subscription.findFirst({ where: {
          organizationId: data.organizationId, status: "ACTIVE", ...(id ? { id: { not: id } } : {}),
          startsAt: { lte: new Date(data.endsAt) }, endsAt: { gte: new Date(data.startsAt) },
        } });
        if (overlap) throw new ConflictException("Active contract dates overlap another organization subscription. Edit or suspend that contract first.");
      }
      const result = id ? await tx.subscription.update({ where: { id }, data }) : await tx.subscription.create({ data });
      await audit(tx, a, "subscription.saved", result.id, { classroomLimit: data.classroomLimit, userLimit: data.userLimit, amount: data.amount });
      return result;
    });
  }
  async onboarding(a: Actor, id: string, body: unknown) {
    this.admin(a);
    const { step } = z
      .object({ step: z.number().int().min(1).max(5) })
      .parse(body);
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${id} FOR UPDATE`;
      const o = await tx.organization.findUniqueOrThrow({ where: { id } });
      const institutions = await tx.institution.findMany({
        where: { organizationId: id },
      });
      const subscriptions = await tx.subscription.findMany({
        where: { organizationId: id },

      });
      const checklist = onboardingChecklist(o, institutions, subscriptions);
      if (step > 1 && !checklist[step - 2].complete)
        throw new BadRequestException(
          "Complete and validate the previous step first",
        );
      if (checklist[step - 1].blockers.length)
        throw new BadRequestException(checklist[step - 1].blockers.join("; "));
      const completedSteps = [...new Set([...o.completedSteps, step])];
      const result = await tx.organization.update({
        where: { id },
        data: {
          completedSteps,
          onboardingStep: Math.max(o.onboardingStep, step + 1),
          status: o.activatedAt ? o.status : "ONBOARDING",
        },
      });
      await audit(tx, a, "onboarding.step-completed", id, { step });
      return result;
    });
  }
  async activate(a: Actor, id: string, regenerate = false) {
    this.admin(a);
    const temporaryPassword = randomBytes(24).toString("base64url") + "aA1!";
    const passwordHash = await argon2.hash(temporaryPassword, {
      type: argon2.argon2id,
    });
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${id} FOR UPDATE`;
      const o = await tx.organization.findUniqueOrThrow({ where: { id } });
      if (![1, 2, 3, 4, 5].every((s) => o.completedSteps.includes(s)))
        throw new BadRequestException("Complete onboarding steps 1–5");
      if (o.activatedAt && !regenerate)
        throw new ConflictException(
          "Already activated. Use Regenerate Credentials explicitly.",
        );
      const institutions = await tx.institution.findMany({
        where: { organizationId: id },
        
      });
      const subscriptions = await tx.subscription.findMany({ where: { organizationId: id } });
      const checklist = onboardingChecklist(o, institutions, subscriptions);
      const blockers = checklist.slice(0, 5).flatMap((step) => step.blockers);
      if (blockers.length) throw new BadRequestException(blockers.join("; "));
      const contract = await activeContract(tx, id);
      if (!institutions.length || institutions.some((i) => !i.logo || !i.officer || !i.phone || !i.email) ||
          !contract || contract.userLimit < 1 || !["SIGNED", "EXCEPTION"].includes(contract.agreementStatus) || !["PAID", "EXCEPTION"].includes(contract.paymentStatus))
        throw new BadRequestException("School identity, organization subscription, user allowance, agreement and payment checks must all pass");
      const user = await tx.user.upsert({
        where: { organizationId: id },
        create: {
          email: o.email,
          name: o.contactName,
          passwordHash,
          organizationId: id,
          role: "ORG_ADMIN",
        },
        update: {
          email: o.email,
          name: o.contactName,
          passwordHash,
          mustChangePassword: true,
        },
      });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.organization.update({
        where: { id },
        data: {
          status: "ACTIVE",
          activatedAt: o.activatedAt || new Date(),
          onboardingStep: 7,
          completedSteps: [1, 2, 3, 4, 5, 6],
        },
      });
      await audit(
        tx,
        a,
        regenerate ? "credentials.regenerated" : "client.activated",
        id,
      );
      return {
        email: user.email,
        temporaryPassword,
        loginUrl: `${process.env.WEB_ORIGIN || "http://localhost:3000"}/?portal=organization`,
      };
    });
  }
  async years(a: Actor, institutionId: string) {
    await this.institution(a, institutionId);
    return db.academicYear.findMany({
      where: { institutionId },
      include: {
        publishedRevision: {
          select: { sequence: true, status: true, warnings: true },
        },
        draftRevision: { select: { sequence: true, lock: true } },
      },
      orderBy: { startsAt: "desc" },
    });
  }
  async createYear(a: Actor, institutionId: string, body: unknown) {
    const data = z
      .object({
        label: text.min(1),
        start: z.string().refine(validDate),
        end: z.string().refine(validDate),
        copyFrom: z.string().uuid().optional(),
      })
      .refine(
        (d) =>
          d.end > d.start &&
          Date.parse(d.end) - Date.parse(d.start) <= 550 * 86400000,
        "Year must end after its start and last at most 550 days",
      )
      .parse(body);
    return db.$transaction(async (tx) => {
      const identity = await this.institution(a, institutionId, tx);
      await lockOrganization(tx, identity.organizationId);
      await tx.$queryRaw`SELECT id FROM "Institution" WHERE id=${institutionId} FOR UPDATE`;
      const i = await this.institution(a, institutionId, tx);
      let c = emptyConfig(i.boards, randomUUID);
      if (data.copyFrom) {
        const old = await this.year(a, data.copyFrom, tx);
        if (old.institutionId !== institutionId)
          throw new BadRequestException(
            "Copy source must belong to the selected school",
          );
        if (!old.publishedRevisionId && !old.draftRevisionId)
          throw new BadRequestException("Copy source is empty");
        c = copyYear(
          await readConfig(
            tx,
            (old.publishedRevisionId || old.draftRevisionId)!,
          ),
        );
      }
      c.boards.push(...emptyConfig(i.boards.filter((name) => !c.boards.some((b) => b.name === name)), randomUUID).boards);
      const y = await tx.academicYear.create({
        data: {
          institutionId,
          label: data.label,
          startsAt: new Date(data.start),
          endsAt: new Date(data.end),
        },
      });
      const r = await tx.revision.create({
        data: {
          yearId: y.id,
          sequence: 1,
          summary: data.copyFrom
            ? "Copied year; dates and recurring rules require review"
            : "New academic year",
        },
      });
      await assertClassroomChange(tx, i.organizationId, y.id, { boards: [] }, c);
      await writeConfig(tx, r.id, c);
      await tx.academicYear.update({
        where: { id: y.id },
        data: { draftRevisionId: r.id },
      });
      await audit(tx, a, "academic-year.created", y.id);
      return y;
    }, { timeout: 30000 });
  }
  async config(a: Actor, yearId: string, revisionId?: string) {
    const y = await this.year(a, yearId);
    const id = revisionId || y.draftRevisionId || y.publishedRevisionId;
    if (!id) throw new NotFoundException();
    const r = await db.revision.findFirstOrThrow({ where: { id, yearId } });
    return {
      year: y,
      revision: r,
      config: await readConfig(db, id),
      license: await organizationUsage(db, (await this.institution(a, y.institutionId)).organizationId),
      published: y.publishedRevisionId
        ? await readConfig(db, y.publishedRevisionId)
        : null,
    };
  }
  async draft(a: Actor, yearId: string, body: unknown) {
    const { restoreRevisionId } = z
      .object({ restoreRevisionId: z.string().uuid().optional() })
      .parse(body);
    return db.$transaction(async (tx) => {
      const initialYear = await this.year(a, yearId, tx);
      const owner = await this.institution(a, initialYear.institutionId, tx);
      await lockOrganization(tx, owner.organizationId);
      await tx.$queryRaw`SELECT id FROM "AcademicYear" WHERE id=${yearId} FOR UPDATE`;
      const y = await this.year(a, yearId, tx);
      if (y.draftRevisionId)
        throw new ConflictException("A working draft already exists");
      const source = restoreRevisionId || y.publishedRevisionId;
      if (!source) throw new BadRequestException("No source configuration");
      const old = await tx.revision.findFirstOrThrow({
        where: { id: source, yearId, status: { not: "DRAFT" } },
      });
      const latest = await tx.revision.aggregate({
        where: { yearId },
        _max: { sequence: true },
      });
      const r = await tx.revision.create({
        data: {
          yearId,
          sequence: (latest._max.sequence || 0) + 1,
          summary: restoreRevisionId
            ? `Restored from version ${old.sequence}`
            : "Working draft",
        },
      });
      const restored = await readConfig(tx, source);
      restored.boards.push(...emptyConfig(owner.boards.filter((name) => !restored.boards.some((b) => b.name === name)), randomUUID).boards);
      await assertClassroomChange(tx, owner.organizationId, yearId, y.publishedRevisionId ? await readConfig(tx, y.publishedRevisionId) : { boards: [] }, restored);
      await writeConfig(tx, r.id, restored);
      await tx.academicYear.update({
        where: { id: yearId },
        data: { draftRevisionId: r.id },
      });
      await audit(tx, a, "structure.draft-created", yearId, { source });
      return r;
    }, { timeout: 30000 });
  }
  async saveConfig(a: Actor, yearId: string, body: unknown) {
    const { config, lock } = z
      .object({ config: configSchema, lock: z.number().int() })
      .parse(body);
    return db.$transaction(
      async (tx) => {
        const y0 = await this.year(a, yearId, tx);
        const owner = await this.institution(a, y0.institutionId, tx);
        await lockOrganization(tx, owner.organizationId);
        await tx.$queryRaw`SELECT id FROM "Institution" WHERE id=${y0.institutionId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "AcademicYear" WHERE id=${yearId} FOR UPDATE`;
        const y = await this.year(a, yearId, tx);
        const i = await this.institution(a, y.institutionId, tx);
        if (!y.draftRevisionId)
          throw new BadRequestException(
            "Create a working draft before editing",
          );
        const r = await tx.revision.findUniqueOrThrow({
          where: { id: y.draftRevisionId },
        });
        if (r.lock !== lock)
          throw new ConflictException(
            "This draft changed elsewhere. Reload before saving.",
          );
        if (
          config.boards.some((b) => !i.boards.includes(b.name)) ||
          i.boards.some((b) => !config.boards.some((x) => x.name === b))
        )
          throw new BadRequestException(
            "Boards must match the registered affiliations",
          );
        const old = await readConfig(tx, r.id);
        await assertClassroomChange(tx, i.organizationId, yearId, old, config);
        const refs = review(
          config,
          Number.MAX_SAFE_INTEGER,
          y.startsAt.toISOString().slice(0, 10),
          y.startsAt.toISOString().slice(0, 10),
        ).filter((x) =>
          /invalid section|invalid target|duplicate/i.test(x.message),
        );
        if (refs.some((x) => x.severity === "error"))
          throw new BadRequestException(refs.map((x) => x.message).join("; "));
        await writeConfig(tx, r.id, config);
        await tx.revision.update({
          where: { id: r.id },
          data: { lock: { increment: 1 } },
        });
        return { lock: r.lock + 1, savedAt: new Date(), license: await organizationUsage(tx, i.organizationId) };
      },
      { timeout: 30000 },
    );
  }
  async preview(a: Actor, yearId: string, body: unknown) {
    const y = await this.year(a, yearId);
    const data = z.object({
      board: boardSchema,
      config: configSchema.optional(),
      dates: z.array(z.string().refine(validDate)).min(1).max(32),
      filter: z.object({ sectionId: z.string().optional(), gradeId: z.string().optional(), classroomId: z.string().optional() }).default({}),
    }).parse(body);
    const i = await this.institution(a, y.institutionId);
    if (!i.boards.includes(data.board.name)) throw new BadRequestException("Board is not registered for this school");
    const start = y.startsAt.toISOString().slice(0,10), end = y.endsAt.toISOString().slice(0,10);
    if (data.dates.some((d) => d < start || d > end)) throw new BadRequestException("Preview dates must fall within the academic year");
    const stored = data.config || (await this.config(a, yearId)).config;
    const config = { ...stored, boards: stored.boards.map((b) => b.id === data.board.id ? data.board : b) };
    if (!config.boards.some((b) => b.id === data.board.id) || config.boards.some((b) => !i.boards.includes(b.name))) throw new BadRequestException("Preview boards must belong to this school");
    const rooms = selectedClassrooms(data.board, data.filter);
    return data.dates.map((date) => ({ date, ...calendarDay(data.board, rooms, date, config) }));
  }
  async calendarSummary(a: Actor, yearId: string, body: unknown) {
    const stored = await this.config(a, yearId);
    const data = z.object({ config: configSchema.optional(), boardId: z.string().uuid().optional(),
      filter: z.object({ sectionId: z.string().optional(), gradeId: z.string().optional(), classroomId: z.string().optional() }).default({}),
    }).parse(body);
    const config = data.config || stored.config;
    const school = await this.institution(a, stored.year.institutionId);
    if (config.boards.some((b) => !school.boards.includes(b.name))) throw new BadRequestException("Calendar boards must belong to this school");
    if (data.boardId && !config.boards.some((b) => b.id === data.boardId)) throw new BadRequestException("Board does not belong to this school year");
    return calendarSummary(config, stored.year.startsAt.toISOString().slice(0, 10), stored.year.endsAt.toISOString().slice(0, 10), data.boardId, data.filter);
  }
  async review(a: Actor, yearId: string) {
    const { year, config, published } = await this.config(a, yearId);
    const i = await this.institution(a, year.institutionId);
    const issues = review(
      config,
      Number.MAX_SAFE_INTEGER,
      year.startsAt.toISOString().slice(0, 10),
      year.endsAt.toISOString().slice(0, 10),
    );
    if (!i.logo || !i.registration || !i.name)
      issues.push({
        severity: "error",
        message: "School registration and logo are mandatory",
      });
    const license = await organizationUsage(db, i.organizationId);
    if (license.overLimit) issues.push({ severity: "warning", message: `Organization exceeds its classroom allowance (${license.used} / ${license.limit}). Additional classrooms are blocked.` });
    return {
      changes: configurationChanges(published, config),
      issues,
      classrooms: countClassrooms(config),
      license,
    };
  }
  async publish(a: Actor, yearId: string, body: unknown) {
    const { lock, summary } = z
      .object({
        lock: z.number().int(),
        summary: z.string().trim().min(1).max(1000),
      })
      .parse(body);
    return db.$transaction(
      async (tx) => {
        const y0 = await this.year(a, yearId, tx);
        const owner = await this.institution(a, y0.institutionId, tx);
        await lockOrganization(tx, owner.organizationId);
        await tx.$queryRaw`SELECT id FROM "Institution" WHERE id=${y0.institutionId} FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM "AcademicYear" WHERE id=${yearId} FOR UPDATE`;
        const y = await this.year(a, yearId, tx);
        const i = await this.institution(a, y.institutionId, tx);
        if (!y.draftRevisionId)
          throw new BadRequestException("No working draft");
        const r = await tx.revision.findUniqueOrThrow({
          where: { id: y.draftRevisionId },
        });
        if (r.lock !== lock)
          throw new ConflictException("Review the latest saved draft");
        const s = await activeContract(tx, i.organizationId);
        if (!s) throw new BadRequestException("An active, valid organization subscription is required");
        const config = await readConfig(tx, r.id);
        const issues = review(
          config,
          Number.MAX_SAFE_INTEGER,
          y.startsAt.toISOString().slice(0, 10),
          y.endsAt.toISOString().slice(0, 10),
        );
        const usage = await organizationUsage(tx, i.organizationId);
        if (usage.overLimit) issues.push({ severity: "warning", message: `Organization exceeds its classroom allowance (${usage.used} / ${usage.limit}). Existing edits and removals are permitted; new classrooms are blocked.` });
        if (!i.logo)
          issues.push({
            severity: "error",
            message: "School logo is mandatory",
          });
        if (issues.some((x) => x.severity === "error"))
          throw new BadRequestException({
            message: "Resolve blocking errors before publication",
            issues,
          });
        await tx.revision.update({
          where: { id: r.id },
          data: {
            status: issues.length ? "INCOMPLETE_ACTIVE" : "ACTIVE",
            summary,
            warnings: json(issues),
            publishedAt: new Date(),
          },
        });
        await tx.academicYear.update({
          where: { id: yearId },
          data: { publishedRevisionId: r.id, draftRevisionId: null },
        });
        await audit(tx, a, "structure.published", yearId, {
          changes: configurationChanges(
            y.publishedRevisionId
              ? await readConfig(tx, y.publishedRevisionId)
              : null,
            config,
          ),
          revision: r.sequence,
          classrooms: countClassrooms(config),
          warnings: issues.length,
        });
        return { ok: true, issues };
      },
      { timeout: 60000 },
    );
  }
  async history(a: Actor, yearId: string) {
    await this.year(a, yearId);
    return db.revision.findMany({
      where: { yearId, status: { not: "DRAFT" } },
      select: {
        id: true,
        sequence: true,
        status: true,
        summary: true,
        publishedAt: true,
        warnings: true,
      },
      orderBy: { sequence: "desc" },
    });
  }
  async discard(a: Actor, yearId: string) {
    return db.$transaction(async (tx) => {
      const initialYear = await this.year(a, yearId, tx);
      const owner = await this.institution(a, initialYear.institutionId, tx);
      await lockOrganization(tx, owner.organizationId);
      await tx.$queryRaw`SELECT id FROM "AcademicYear" WHERE id=${yearId} FOR UPDATE`;
      const y = await this.year(a, yearId, tx);
      if (!y.draftRevisionId || !y.publishedRevisionId)
        throw new BadRequestException(
          "Only changes to a published configuration can be discarded",
        );
      await tx.academicYear.update({
        where: { id: yearId },
        data: { draftRevisionId: null },
      });
      await tx.revision.delete({ where: { id: y.draftRevisionId } });
      await audit(tx, a, "structure.draft-discarded", yearId);
      return { ok: true };
    });
  }
  async request(a: Actor, body: unknown) {
    const data = z
      .object({
        institutionId: z.string().uuid(),
        proposed: institutionSchema
          .partial()
          .strict()
          .refine(
            (v) => Object.keys(v).length > 0,
            "Choose at least one registration field",
          ),
        reason: z.string().trim().min(5).max(2000),
      })
      .parse(body);
    const i = await this.institution(a, data.institutionId);
    return db.changeRequest.create({
      data: {
        ...data,
        proposed: json(data.proposed),
        organizationId: i.organizationId,
      },
    });
  }
  async requests(a: Actor) {
    return db.changeRequest.findMany({
      where:
        a.role === "PLATFORM_ADMIN"
          ? {}
          : { organizationId: a.organizationId || "denied" },
      include: { organization: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
  async resolveRequest(a: Actor, id: string, body: unknown) {
    this.admin(a);
    const data = z
      .object({ approve: z.boolean(), resolution: z.string().min(1).max(2000) })
      .parse(body);
    return db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "ChangeRequest" WHERE id=${id} FOR UPDATE`;
      const r = await tx.changeRequest.findUniqueOrThrow({ where: { id } });
      if (r.status !== "PENDING")
        throw new ConflictException("Request already resolved");
      if (data.approve) {
        const current = await tx.institution.findUniqueOrThrow({
          where: { id: r.institutionId },
        });
        const proposed = institutionSchema.parse({
          ...current,
          ...(r.proposed as object),
        });
        if (
          current.boards.some((b) => !proposed.boards.includes(b)) &&
          (await tx.academicYear.count({
            where: { institutionId: current.id },
          }))
        )
          throw new BadRequestException(
            "Cannot remove a board with academic configuration history",
          );
        await tx.institution.update({
          where: { id: current.id },
          data: proposed,
        });
      }
      const result = await tx.changeRequest.update({
        where: { id },
        data: {
          status: data.approve ? "APPROVED" : "REJECTED",
          resolution: data.resolution,
          resolvedAt: new Date(),
        },
      });
      await audit(tx, a, "request.resolved", id, { status: result.status });
      return result;
    });
  }
  async audits(a: Actor) {
    this.admin(a);
    return db.auditLog.findMany({ take: 200, orderBy: { createdAt: "desc" } });
  }
  async usage(a: Actor) {
    const orgs = a.role === "PLATFORM_ADMIN"
      ? await db.organization.findMany({ select: { id: true } })
      : [{ id: a.organizationId || "denied" }];
    return Promise.all(orgs.map((o) => organizationUsage(db, o.id)));
  }
}
