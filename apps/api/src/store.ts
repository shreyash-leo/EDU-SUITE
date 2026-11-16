import { ConflictException } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { Config } from "../../../packages/domain/src";
export const db = new PrismaClient();
export type Tx = Prisma.TransactionClient;
export const json = (x: unknown) => x as Prisma.InputJsonValue;
export const revisionInclude = {
  boards: {
    include: {
      sections: true,
      grades: { include: { classrooms: true } },
      schedules: true,
      events: true,
    },
  },
} as const;
export async function readConfig(tx: Tx, revisionId: string): Promise<Config> {
  const r = await tx.revision.findUniqueOrThrow({
    where: { id: revisionId },
    include: revisionInclude,
  });
  return {
    resolverVersion: r.resolverVersion === 2 ? 2 : 1,
    boards: r.boards.map((b) => ({
      id: b.boardKey,
      name: b.name,
      nonWorkingDays: b.nonWorkingDays,
      sections: b.sections.map((s) => ({ id: s.entityKey, name: s.name })),
      grades: b.grades.map((g) => ({
        id: g.entityKey,
        name: g.name,
        active: g.active,
        sectionId: g.sectionId
          ? b.sections.find((s) => s.id === g.sectionId)?.entityKey || null
          : null,
        classrooms: g.classrooms.map((c) => ({
          id: c.entityKey,
          name: c.name,
          active: c.active,
          capacity: c.capacity,
        })),
      })),
      schedules: b.schedules.map((s) => ({
        id: s.entityKey,
        name: s.name,
        arrival: s.arrival,
        dispersal: s.dispersal,
        dayType: s.dayType as "full" | "half",
        templateOnly: s.templateOnly,
        target: s.target,
        rule: s.rule,
        slots: s.slots,
      })) as Config["boards"][number]["schedules"],
      events: b.events.map((e) => ({
        id: e.entityKey,
        name: e.name,
        kind: e.kind,
        overridesHoliday: e.overridesHoliday,
        ...(e.scheduling as object),
        target: e.target,
        rule: e.rule,
      })) as Config["boards"][number]["events"],
    })),
  };
}
export async function writeConfig(tx: Tx, revisionId: string, c: Config) {
  const revision = await tx.revision.findUniqueOrThrow({ where: { id: revisionId }, select: { status: true } });
  if (revision.status !== "DRAFT") throw new ConflictException("Published configurations are read-only. Create a working draft first.");
  await tx.revision.update({ where: { id: revisionId }, data: { resolverVersion: c.resolverVersion || 1 } });
  await tx.revisionBoard.deleteMany({ where: { revisionId } });
  for (const b of c.boards) {
    const boardId = randomUUID();
    await tx.revisionBoard.create({
      data: {
        id: boardId,
        revisionId,
        boardKey: b.id,
        name: b.name,
        nonWorkingDays: b.nonWorkingDays,
      },
    });
    const sectionMap = new Map<string, string>();
    for (const s of b.sections) {
      const id = randomUUID();
      sectionMap.set(s.id, id);
      await tx.section.create({
        data: { id, boardId, entityKey: s.id, name: s.name },
      });
    }
    for (const g of b.grades) {
      const id = randomUUID();
      await tx.grade.create({
        data: {
          id,
          boardId,
          entityKey: g.id,
          name: g.name,
          active: g.active,
          sectionId: g.sectionId ? sectionMap.get(g.sectionId) : null,
        },
      });
      if (g.classrooms.length)
        await tx.classroom.createMany({
          data: g.classrooms.map((c) => ({
            id: randomUUID(),
            boardId,
            gradeId: id,
            entityKey: c.id,
            name: c.name,
            active: c.active,
            capacity: c.capacity,
          })),
        });
    }
    if (b.schedules.length)
      await tx.schedule.createMany({
        data: b.schedules.map((s) => ({
          id: randomUUID(),
          boardId,
          entityKey: s.id,
          name: s.name,
          arrival: s.arrival,
          dispersal: s.dispersal,
          dayType: s.dayType || "full",
          templateOnly: s.templateOnly || false,
          target: json(s.target),
          rule: json(s.rule),
          slots: json(s.slots),
        })),
      });
    if (b.events.length)
      await tx.calendarEvent.createMany({
        data: b.events.map((e) => ({
          id: randomUUID(),
          boardId,
          entityKey: e.id,
          name: e.name,
          kind: e.kind,
          overridesHoliday: e.overridesHoliday || false,
          scheduling: json({ ...(e.operation ? { operation: e.operation } : {}), ...(e.configurationPart ? { configurationPart: e.configurationPart } : {}), ...(e.parentId ? { parentId: e.parentId } : {}), ...(e.scheduleId ? { scheduleId: e.scheduleId } : {}) }),
          target: json(e.target),
          rule: json(e.rule),
        })),
      });
  }
}
export async function audit(
  tx: Tx,
  actor: { id: string; organizationId?: string | null },
  action: string,
  entityId: string,
  detail: unknown = {},
) {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      organizationId: actor.organizationId,
      action,
      entityId,
      detail: json(detail),
    },
  });
}
