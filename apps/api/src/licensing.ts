import { BadRequestException, ConflictException } from "@nestjs/common";
import { countClassrooms, organizationUtilization, type Config } from "../../../packages/domain/src";
import { type Tx } from "./store";

// Every writer that can increase consumption acquires this lock FIRST.
// READ COMMITTED queries after the lock see the previous writer's committed state.
export async function lockOrganization(tx: Tx, organizationId: string) {
  await tx.$queryRaw`SELECT id FROM "Organization" WHERE id=${organizationId} FOR UPDATE`;
}
export async function activeContract(tx: Tx, organizationId: string, now = new Date()) {
  const contracts = await tx.subscription.findMany({
    where: { organizationId, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { startsAt: "desc" },
  });
  if (contracts.length > 1) throw new ConflictException("Overlapping active organization contracts. Ask Super Admin to resolve the subscriptions.");
  return contracts[0] || null;
}
export async function organizationUsage(tx: Tx, organizationId: string, proposal?: { yearId: string; config: Config }) {
  const institutions = await tx.institution.findMany({
    where: { organizationId },
    select: { id: true, years: { select: { id: true, publishedRevisionId: true, draftRevisionId: true } } },
  });
  const ids = institutions.flatMap((i) => i.years.flatMap((y) => [y.publishedRevisionId, y.draftRevisionId].filter((id): id is string => !!id)));
  const revisions = await tx.revision.findMany({
    where: { id: { in: ids } },
    select: { id: true, boards: { select: { _count: { select: { classrooms: true } } } } },
  });
  const counts = new Map(revisions.map((r) => [r.id, r.boards.reduce((n, b) => n + b._count.classrooms, 0)]));
  const usage = organizationUtilization(institutions.map((i) => ({
    institutionId: i.id,
    years: i.years.map((y) => ({
      yearId: y.id,
      published: counts.get(y.publishedRevisionId || "") || 0,
      draft: proposal?.yearId === y.id ? countClassrooms(proposal.config) : counts.get(y.draftRevisionId || "") || 0,
    })),
  })));
  const contracts = await tx.subscription.findMany({ where: { organizationId, status: "ACTIVE", startsAt: { lte: new Date() }, endsAt: { gte: new Date() } } });
  const contract = contracts.length === 1 ? contracts[0] : null;
  const limit = contract?.classroomLimit || 0;
  return { ...usage, organizationId, limit, remaining: Math.max(0, limit - usage.used), overLimit: usage.used > limit, userLimit: contract?.userLimit || 0, users: await tx.user.count({ where: { organizationId } }), contractId: contract?.id || null, contractConflict: contracts.length > 1 };
}
export async function assertClassroomChange(tx: Tx, organizationId: string, yearId: string, previous: Config, proposed: Config) {
  const oldIds = new Set(previous.boards.flatMap((b) => b.grades.flatMap((g) => g.classrooms.map((c) => c.id))));
  const adds = proposed.boards.some((b) => b.grades.some((g) => g.classrooms.some((c) => !oldIds.has(c.id))));
  if (!adds) return; // Preserve edits and reductions, even after contract expiry/reduction.
  const contract = await activeContract(tx, organizationId);
  if (!contract) throw new BadRequestException("An active organization subscription is required to create classrooms");
  const next = await organizationUsage(tx, organizationId, { yearId, config: proposed });
  if (next.used > contract.classroomLimit) throw new BadRequestException(`Organization classroom limit reached (${next.used} / ${contract.classroomLimit}). Increase the shared allowance or remove classrooms.`);
}
