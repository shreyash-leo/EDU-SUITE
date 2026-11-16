import { review } from "../../../packages/domain/src";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, readConfig } from "./store";
import { structureStatuses, structureStatus, operationalYear } from "../../../packages/domain/src/portal";
import { classroomCounts } from "../../../packages/domain/src/refinement";
import { calendarSummary, configurationChanges } from "../../../packages/domain/src/enhancements";
import { organizationUsage } from "./licensing";
import { NotFoundException } from "@nestjs/common";
const querySchema = z.object({ search: z.string().trim().max(100).default(""), board: z.string().max(100).default(""), schoolStatus: z.enum(["", "ACTIVE", "INACTIVE"]).default(""), status: z.enum([...structureStatuses, "ATTENTION", "CONFIGURED", "IN_PROGRESS", ""]).default(""), sort: z.enum(["name", "updated"]).default("name"), page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(12), schoolId: z.string().uuid().optional(), yearId: z.string().uuid().optional() });
// One selected academic year per school, never a union of unrelated years.
function schoolRows(organizationId: string, selection: { schoolId?: string; yearId?: string }, unchanged: string[] = []) {
  const now = new Date();
  return Prisma.sql`WITH school_rows AS (
    SELECT i.*, y.id AS "yearId", y.label AS "yearLabel", y."startsAt", y."endsAt", y."draftRevisionId", y."publishedRevisionId", p."publishedAt", p.warnings,
      CASE WHEN y."draftRevisionId" IS NOT NULL AND y."publishedRevisionId" IS NOT NULL AND ${unchanged.length ? Prisma.sql`y.id IN (${Prisma.join(unchanged)})` : Prisma.sql`false`} THEN 'EDITING_DRAFT_NO_CHANGES'
           WHEN y."draftRevisionId" IS NOT NULL AND y."publishedRevisionId" IS NOT NULL THEN 'DRAFT_CHANGES_PENDING'
           WHEN y."draftRevisionId" IS NOT NULL THEN 'DRAFT'
           WHEN y."publishedRevisionId" IS NULL THEN 'NOT_STARTED'
           WHEN p.status='INCOMPLETE_ACTIVE' THEN 'INCOMPLETE_ACTIVE' ELSE 'ACTIVE' END AS "structureStatus",
      GREATEST(i."updatedAt", p."updatedAt", d."updatedAt") AS "lastUpdated",
      (SELECT COUNT(*)::int FROM "Classroom" c JOIN "RevisionBoard" b ON b.id=c."boardId" WHERE b."revisionId"=COALESCE(y."draftRevisionId", y."publishedRevisionId")) AS "classroomCount",
      (SELECT COUNT(*)::int FROM "Classroom" c JOIN "RevisionBoard" b ON b.id=c."boardId" WHERE b."revisionId"=COALESCE(y."draftRevisionId",y."publishedRevisionId") AND c.active) AS "activeClassroomFlags",
      (SELECT COUNT(*)::int FROM "Classroom" c JOIN "Grade" g ON g.id=c."gradeId" JOIN "RevisionBoard" b ON b.id=c."boardId" WHERE b."revisionId"=COALESCE(y."draftRevisionId",y."publishedRevisionId") AND c.active AND g.active) AS "operationallyActiveClassrooms"
    FROM "Institution" i
    JOIN "Organization" o ON o.id=i."organizationId" AND o.status='ACTIVE'
    LEFT JOIN LATERAL (
      SELECT ay.* FROM "AcademicYear" ay WHERE ay."institutionId"=i.id
      ORDER BY CASE WHEN i.id=${selection.schoolId || ""} AND ay.id=${selection.yearId || ""} THEN 0 WHEN ay."startsAt"<=${now} AND ay."endsAt">=${now} THEN 1 WHEN ay."startsAt"<=${now} THEN 2 ELSE 3 END,
        CASE WHEN ay."startsAt"<=${now} THEN ay."startsAt" END DESC,
        ay."startsAt" ASC, ay.id ASC LIMIT 1
    ) y ON true
    LEFT JOIN "Revision" p ON p.id=y."publishedRevisionId"
    LEFT JOIN "Revision" d ON d.id=y."draftRevisionId"
    WHERE i."organizationId"=${organizationId} AND i.status<>'DELETION_PENDING'
  )`;
}
export async function clientDirectory(organizationId: string, query: unknown) {
  const q = querySchema.parse(query);
  const candidates = await db.academicYear.findMany({where:{institution:{organizationId,organization:{status:"ACTIVE"}},draftRevisionId:{not:null},publishedRevisionId:{not:null}},select:{id:true,draftRevisionId:true,publishedRevisionId:true}});
  const unchanged = (await Promise.all(candidates.map(async y=>configurationChanges(await readConfig(db,y.publishedRevisionId!),await readConfig(db,y.draftRevisionId!)).length ? null : y.id))).filter((id):id is string=>!!id);
  const base = schoolRows(organizationId,q,unchanged);
  const status = q.status === "ATTENTION" ? Prisma.sql`("structureStatus" NOT IN ('ACTIVE','EDITING_DRAFT_NO_CHANGES') OR warnings<>'[]'::jsonb)` : q.status === "CONFIGURED" ? Prisma.sql`"publishedRevisionId" IS NOT NULL` : q.status === "IN_PROGRESS" ? Prisma.sql`"structureStatus" IN ('NOT_STARTED','DRAFT')` : q.status ? Prisma.sql`"structureStatus"=${q.status}` : Prisma.sql`true`;
  const search = q.search.replace(/[\\%_]/g, "\\$&");
  const filter = Prisma.sql`name ILIKE ${"%"+search+"%"} AND (${q.board}='' OR ${q.board}=ANY(boards)) AND (${q.schoolStatus}='' OR status=${q.schoolStatus}) AND ${status}`;
  const order = q.sort === "updated" ? Prisma.sql`"lastUpdated" DESC, name ASC, id ASC` : Prisma.sql`name ASC, id ASC`;
  const [rows, count, metrics, attention, boardRows, activity, license, subscriptions] = await Promise.all([
    db.$queryRaw<any[]>(Prisma.sql`${base} SELECT * FROM school_rows WHERE ${filter} ORDER BY ${order} LIMIT ${q.pageSize} OFFSET ${(q.page-1)*q.pageSize}`),
    db.$queryRaw<{ total:number }[]>(Prisma.sql`${base} SELECT COUNT(*)::int AS total FROM school_rows WHERE ${filter}`),
    db.$queryRaw<any[]>(Prisma.sql`${base} SELECT COUNT(*)::int AS total, COALESCE(SUM("classroomCount"),0)::int AS "totalClassrooms", COALESCE(SUM("activeClassroomFlags"),0)::int AS "activeClassroomFlags", COALESCE(SUM("operationallyActiveClassrooms"),0)::int AS "operationallyActiveClassrooms", COUNT(*) FILTER(WHERE "publishedRevisionId" IS NOT NULL)::int AS configured, COUNT(*) FILTER(WHERE "structureStatus" IN ('NOT_STARTED','DRAFT'))::int AS "inProgress", COUNT(*) FILTER(WHERE ("structureStatus" NOT IN ('ACTIVE','EDITING_DRAFT_NO_CHANGES') OR warnings<>'[]'::jsonb))::int AS attention, COUNT(*) FILTER(WHERE "structureStatus"='DRAFT_CHANGES_PENDING')::int AS pending, COUNT(*) FILTER(WHERE "structureStatus"='NOT_STARTED')::int AS "NOT_STARTED", COUNT(*) FILTER(WHERE "structureStatus"='DRAFT')::int AS "DRAFT", COUNT(*) FILTER(WHERE "structureStatus"='ACTIVE')::int AS "ACTIVE", COUNT(*) FILTER(WHERE "structureStatus"='INCOMPLETE_ACTIVE')::int AS "INCOMPLETE_ACTIVE", COUNT(*) FILTER(WHERE "structureStatus"='DRAFT_CHANGES_PENDING')::int AS "DRAFT_CHANGES_PENDING", COUNT(*) FILTER(WHERE "structureStatus"='EDITING_DRAFT_NO_CHANGES')::int AS "EDITING_DRAFT_NO_CHANGES" FROM school_rows`),
    db.$queryRaw<any[]>(Prisma.sql`${base} SELECT * FROM school_rows WHERE ("structureStatus" NOT IN ('ACTIVE','EDITING_DRAFT_NO_CHANGES') OR warnings<>'[]'::jsonb) ORDER BY "lastUpdated" DESC LIMIT 6`),
    db.$queryRaw<{ board:string }[]>(Prisma.sql`SELECT DISTINCT unnest(i.boards) AS board FROM "Institution" i JOIN "Organization" o ON o.id=i."organizationId" AND o.status='ACTIVE' WHERE i."organizationId"=${organizationId} AND i.status<>'DELETION_PENDING' ORDER BY board`),
    db.$queryRaw<any[]>(Prisma.sql`SELECT a.id,a.action,a.detail,a."createdAt",i.id AS "schoolId",i.name AS "schoolName",y.id AS "yearId",y.label AS "yearLabel" FROM "AuditLog" a JOIN "AcademicYear" y ON y.id=a."entityId" JOIN "Institution" i ON i.id=y."institutionId" JOIN "Organization" o ON o.id=i."organizationId" AND o.status='ACTIVE' WHERE i."organizationId"=${organizationId} AND i.status<>'DELETION_PENDING' AND a.action IN ('structure.published','structure.draft-created','structure.draft-discarded','structure.updated','academic-year.created') ORDER BY a."createdAt" DESC LIMIT 8`),
    organizationUsage(db,organizationId),
    db.subscription.findMany({where:{organizationId},orderBy:{endsAt:"desc"},take:5,select:{id:true,status:true,reference:true,startsAt:true,endsAt:true,classroomLimit:true,userLimit:true}}),
  ]);
  const contract = license.contractId ? subscriptions.find((s)=>s.id===license.contractId) || await db.subscription.findFirst({where:{id:license.contractId,organizationId},select:{id:true,status:true,reference:true,startsAt:true,endsAt:true,classroomLimit:true,userLimit:true}}) : null;
  return { contract, rows, total:count[0].total, page:q.page, pageSize:q.pageSize, metrics:metrics[0], attention, boards:boardRows.map((b)=>b.board), activity, license, subscriptions, basis:"Current academic year; otherwise latest started year, then earliest upcoming year. A selected school/year overrides that row only." };
}
export async function clientSchool(organizationId:string, schoolId:string, selected?:string) {
  const school = await db.institution.findFirst({where:{id:schoolId,organizationId,status:{not:"DELETION_PENDING"},organization:{status:"ACTIVE"}},include:{years:{orderBy:{startsAt:"desc"},include:{publishedRevision:{select:{id:true,status:true,sequence:true,publishedAt:true,warnings:true}},draftRevision:{select:{id:true,lock:true,sequence:true}}}}}});
  if(!school) throw new NotFoundException("School unavailable");
  const year = operationalYear(school.years,selected), revisionId=year?.draftRevisionId || year?.publishedRevisionId;
  const config=revisionId ? await readConfig(db,revisionId):null;
  const history=year?await db.revision.findMany({where:{yearId:year.id,status:{not:"DRAFT"}},select:{id:true,sequence:true,status:true,summary:true,publishedAt:true,warnings:true},orderBy:{sequence:"desc"},take:50}):[];
  const boards=config?.boards.map((b)=>({id:b.id,name:b.name,sections:b.sections.length,grades:b.grades.length,activeGrades:b.grades.filter((g)=>g.active).length,classrooms:b.grades.flatMap((g)=>g.classrooms).length,activeClassrooms:b.grades.filter((g)=>g.active).flatMap((g)=>g.classrooms).filter((c)=>c.active).length,defaultSchedules:b.schedules.filter((s)=>s.rule.type==="default").length,advancedSchedules:b.schedules.filter((s)=>s.rule.type!=="default").length,calendarRules:b.events.length,weeklyOffDays:b.nonWorkingDays.length, sectionNames:b.sections.map((s)=>s.name), gradeRows:b.grades.map((g)=>({id:g.id,name:g.name,active:g.active,section:b.sections.find((s)=>s.id===g.sectionId)?.name || "Unassigned",classrooms:g.classrooms.map((c)=>({id:c.id,name:c.name,active:c.active}))}))})) || [];
  const effectiveCalendar=config&&year?calendarSummary(config,year.startsAt.toISOString().slice(0,10),year.endsAt.toISOString().slice(0,10)):null;
  const publication=year?.publishedRevisionId ? await readConfig(db,year.publishedRevisionId) : null;
  const hasChanges=!!config && configurationChanges(publication,config).length>0;
  const validation=config && year ? review(config,Number.MAX_SAFE_INTEGER,year.startsAt.toISOString().slice(0,10),year.endsAt.toISOString().slice(0,10)) : [];
  const readiness=validation.some(i=>i.severity==="error") ? "Requires Attention" : !effectiveCalendar?.classrooms || effectiveCalendar.provisional ? "Incomplete" : "Configured";
  return {school,year,status:structureStatus(year,hasChanges),counts:config?classroomCounts(config):classroomCounts({boards:[]}),readiness,boards,history,calendar:effectiveCalendar ? { ...effectiveCalendar, rows: undefined } : null,hasGrades:boards.some((b)=>b.grades>0),hasCalendar:readiness === "Configured",basis:year?.draftRevisionId?"Working draft":"Published configuration"};
}
