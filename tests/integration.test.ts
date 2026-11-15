import { defaultPlatformSettings } from "../packages/domain/src/enhancements";
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import type { AppService, Actor } from "../apps/api/src/service";

// Run only against an explicitly configured disposable PostgreSQL database.
const integration = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
integration("PostgreSQL service integration", () => {
  let s: AppService;
  let db: typeof import("../apps/api/src/store").db;
  let readConfig: typeof import("../apps/api/src/store").readConfig;
  let verify: typeof import("../apps/api/src/password").verify;
  beforeAll(async () => {
    const svc = await import("../apps/api/src/service");
    s = new svc.AppService();
    ({ db, readConfig } = await import("../apps/api/src/store"));
    ({ verify } = await import("../apps/api/src/password"));
  });
  const admin: Actor = {
    id: randomUUID(),
    role: "PLATFORM_ADMIN",
    organizationId: null,
    mustChangePassword: false,
  };
  const created: string[] = [];
  let originalSettings: any;
  beforeAll(async () => {
    originalSettings = await db.platformSetting.findUnique({
      where: { id: "platform" },
    });
  });
  afterAll(async () => {
    for (const id of created) {
      await db.changeRequest.deleteMany({ where: { organizationId: id } });
      await db.entitlement.deleteMany({
        where: { institution: { organizationId: id } },
      });
      await db.institution.deleteMany({ where: { organizationId: id } });
      await db.subscription.deleteMany({ where: { organizationId: id } });
      await db.user.deleteMany({ where: { organizationId: id } });
      await db.organization.delete({ where: { id } });
    }
    if (originalSettings)
      await db.platformSetting.upsert({
        where: { id: "platform" },
        create: originalSettings,
        update: originalSettings,
      });
    else await db.platformSetting.deleteMany({ where: { id: "platform" } });
    await db.$disconnect();
  });
  it("persists shared calendars, explicit reopening, scoped summaries and tenant profile", async () => {
    const suffix = randomUUID().slice(0, 8);
    const org = await s.saveOrg(admin, { name: "Calendar Scope " + suffix, email: `${suffix}-calendar@example.com` }); created.push(org.id);
    const school = await s.saveInstitution(admin, { organizationId: org.id, name: "Calendar School " + suffix, registration: suffix, boards: ["CBSE", "ICSE"], logo: "https://example.com/test.png" });
    await s.saveSubscription(admin, { organizationId: org.id, reference: "CAL-" + suffix, amount: 1000, startsAt: "2026-01-01T00:00:00Z", endsAt: "2099-12-31T23:59:59Z", status: "ACTIVE", agreementStatus: "SIGNED", paymentStatus: "PAID", classroomLimit: 2, userLimit: 1 });
    const year = await s.createYear(admin, school.id, { label: "2026–27", start: "2026-11-01", end: "2027-03-31" });
    const draft = await s.config(admin, year.id);
    for (const board of draft.config.boards) board.grades.push({ id: randomUUID(), name: "Grade 1", active: true, sectionId: null, classrooms: [{ id: randomUUID(), name: "1A", active: true }] });
    const [a, b] = draft.config.boards;
    a.schedules.push({ id: randomUUID(), name: "Common school day", arrival: 480, dispersal: 540, target: { scope: "school", ids: [] }, rule: { type: "default", weekdays: [], intervalWeeks: 1 }, slots: [{ id: randomUUID(), name: "P1", kind: "period", start: 480, end: 540 }] });
    a.events.push({ id: randomUUID(), name: "Regular closure", kind: "holiday", target: { scope: "school", ids: [] }, rule: { type: "recurring", weekdays: [1], intervalWeeks: 1 } });
    b.events.push({ id: randomUUID(), name: "Deliberately reopen", kind: "working", overridesHoliday: true, target: { scope: "board", ids: [] }, rule: { type: "date", date: "2026-11-16", weekdays: [], intervalWeeks: 1 } });
    await s.saveConfig(admin, year.id, { config: draft.config, lock: draft.revision.lock });
    const saved = await s.config(admin, year.id);
    expect(saved.config.boards[1].events[0].overridesHoliday).toBe(true);
    const preview = await s.preview(admin, year.id, { board: saved.config.boards[1], dates: ["2026-11-16"] });
    expect(preview[0].status).toBe("working"); expect(preview[0].results[0].schedule?.name).toBe("Common school day");
    const summary = await s.calendarSummary(admin, year.id, {});
    expect(summary.classrooms).toBe(2); expect(summary.mixed).toBe(true);
    // One config write persists the complete accepted bulk-grade set atomically.
    const bulk = await s.config(admin, year.id);
    bulk.config.boards[0].grades.push(...Array.from({ length: 11 }, (_, n) => ({ id: randomUUID(), name: `Grade ${n + 2}`, active: true, sectionId: null, classrooms: [] })));
    await s.saveConfig(admin, year.id, { config: bulk.config, lock: bulk.revision.lock });
    expect((await s.config(admin, year.id)).config.boards[0].grades).toHaveLength(12);
    const duplicate = await s.config(admin, year.id);
    duplicate.config.boards[0].grades.push({ ...duplicate.config.boards[0].grades[0], id: randomUUID(), classrooms: [] });
    await expect(s.saveConfig(admin, year.id, { config: duplicate.config, lock: duplicate.revision.lock })).rejects.toThrow(/duplicate/);
    expect((await s.config(admin, year.id)).config.boards[0].grades).toHaveLength(12);
    const beforePublication = await s.config(admin, year.id);
    await s.publish(admin, year.id, { lock: beforePublication.revision.lock, summary: "Before registering another board" });
    await s.draft(admin, year.id, {});
    const beforeSync = await s.config(admin, year.id);
    await s.saveInstitution(admin, { ...school, organizationId: org.id, boards: ["CBSE", "ICSE", "IB"] }, school.id);
    const afterSync = await s.config(admin, year.id);
    expect(afterSync.config.boards.map((b) => b.name)).toContain("IB");
    expect(afterSync.revision.lock).toBe(beforeSync.revision.lock + 1);
    expect(afterSync.published?.boards.map((b) => b.name)).not.toContain("IB");
    await expect(s.saveInstitution(admin, { ...school, organizationId: org.id, boards: ["CBSE"] }, school.id)).rejects.toThrow(/cannot be removed/);
    const tenant: Actor = { ...admin, role: "ORG_ADMIN", organizationId: org.id };
    expect((await s.organizationProfile(tenant)).id).toBe(org.id);
    await expect(s.calendarSummary({ ...tenant, organizationId: randomUUID() }, year.id, {})).rejects.toThrow();
  });
  it("scopes paginated client directories, selected years and school details to the organization", async () => {
    const suffix=randomUUID().slice(0,8), org=await s.saveOrg(admin,{name:"Portal "+suffix,email:`portal-${suffix}@example.com`}); created.push(org.id);
    await db.organization.update({where:{id:org.id},data:{status:"ACTIVE"}});
    const school=await s.saveInstitution(admin,{organizationId:org.id,name:"Alpha "+suffix,registration:"A"+suffix,boards:["CBSE","ICSE"]});
    await s.saveInstitution(admin,{organizationId:org.id,name:"Beta "+suffix,registration:"B"+suffix,boards:["IB"]});
    const currentYear=new Date().getUTCFullYear(), current=await s.createYear(admin,school.id,{label:"Current",start:`${currentYear}-01-01`,end:`${currentYear}-12-31`});
    const future=await s.createYear(admin,school.id,{label:"Future",start:`${currentYear+1}-01-01`,end:`${currentYear+1}-12-31`});
    const tenant:Actor={...admin,role:"ORG_ADMIN",organizationId:org.id};
    const page=await s.clientPortal(tenant,{page:1,pageSize:1});
    expect(page.total).toBe(2);expect(page.rows).toHaveLength(1);expect(page.metrics.total).toBe(2);
    expect(page.rows[0].yearId).toBe(current.id);expect(page.rows[0].structureStatus).toBe("DRAFT");
    expect((await s.clientPortal(tenant,{page:2,pageSize:1})).rows[0].name).toBe("Beta "+suffix);
    const selected=await s.clientPortal(tenant,{schoolId:school.id,yearId:future.id,board:"CBSE",status:"DRAFT"});
    expect(selected.total).toBe(1);expect(selected.rows[0].yearId).toBe(future.id);
    expect((await s.clientPortal(tenant,{search:"unmatched"})).total).toBe(0);
    const details=await s.clientSchool(tenant,school.id,current.id);expect(details.year?.id).toBe(current.id);expect(details.school.boards).toEqual(["CBSE","ICSE"]);
    const other:Actor={...tenant,organizationId:randomUUID()};
    expect((await s.clientPortal(other,{})).rows).toEqual([]);
    await expect(s.clientSchool(other,school.id,current.id)).rejects.toThrow(/unavailable/);
    await expect(s.clientPortal(admin,{})).rejects.toThrow(/Organization account/);
    await db.institution.update({where:{id:school.id},data:{status:"INACTIVE"}});
    expect((await s.clientSchool(tenant,school.id)).school.status).toBe("INACTIVE");
    const inactive=await s.clientPortal(tenant,{schoolStatus:"INACTIVE",board:"CBSE"});
    expect(inactive.total).toBe(1);expect(inactive.rows[0].id).toBe(school.id);
    expect((await s.clientPortal(tenant,{schoolStatus:"ACTIVE"})).total).toBe(1);
    await expect(s.config(tenant,current.id)).rejects.toThrow(/unavailable/);
    await db.institution.update({where:{id:school.id},data:{status:"DELETION_PENDING"}});
    expect((await s.clientPortal(tenant,{})).total).toBe(1);
    await expect(s.clientSchool(tenant,school.id)).rejects.toThrow(/unavailable/);
  });
  it("persists presets atomically and rejects stale or foreign draft edits", async () => {
    const suffix = randomUUID().slice(0, 8);
    const org = await s.saveOrg(admin, { name: "Preset test " + suffix, email: `${suffix}-preset@example.com` }); created.push(org.id);
    const school = await s.saveInstitution(admin, { organizationId: org.id, name: "Preset school " + suffix, registration: suffix, boards: ["CBSE", "ICSE"] });
    const year = await s.createYear(admin, school.id, { label: "2026–27", start: "2026-11-01", end: "2027-03-31" });
    const initial = await s.config(admin, year.id);
    const body = { boardId: initial.config.boards[0].id, lock: initial.revision.lock, revisionId: initial.revision.id, selection: { sections: ["Primary"], grades: [{ name: "Grade 1", section: "Primary" }] } };
    const preview = await s.presetPreview(admin, year.id, body);
    expect(preview.createdGrades).toBe(1);
    expect((await s.config(admin, year.id)).revision.lock).toBe(initial.revision.lock);
    await s.presetPreview(admin, year.id, body, true);
    const saved = await s.config(admin, year.id);
    expect(saved.config.boards[0].grades).toHaveLength(1);
    expect(saved.config.boards[1]).toEqual(initial.config.boards[1]);
    await expect(s.presetPreview(admin, year.id, body, true)).rejects.toThrow(/changed/);
    await expect(s.saveConfig(admin, year.id, { config: saved.config, lock: saved.revision.lock, revisionId: randomUUID() })).rejects.toThrow(/replaced/);
    const foreign = structuredClone(saved.config); foreign.boards[1].grades.push(foreign.boards[0].grades.pop()!);
    await expect(s.saveConfig(admin, year.id, { config: foreign, lock: saved.revision.lock, revisionId: saved.revision.id })).rejects.toThrow(/original board/);
    const next = structuredClone(saved.config); next.boards[0].grades[0].sectionId = null;
    const impact = await s.impactPreview(admin, year.id, { config: next, lock: saved.revision.lock, revisionId: saved.revision.id });
    expect(impact.updated).toBe(1);
    const dates = await s.rulePreview(admin, year.id, { rule: { type: "recurring", weekdays: [6], nth: 5, startsOn: "2027-01-01", endsOn: "2027-02-28" } });
    expect(dates.dates).toEqual(["2027-01-30"]);
    expect((await s.config(admin, year.id)).config).toEqual(saved.config);
  });
  it("serializes classroom creation across institutions and preserves over-limit records", async () => {
    const suffix = randomUUID().slice(0, 8);
    const o = await s.saveOrg(admin, { name: "Shared Pool " + suffix, email: `${suffix}-shared@example.com` });
    created.push(o.id);
    const contractData = {
      organizationId: o.id, reference: "SHARED-" + suffix, amount: 5000,
      startsAt: "2026-01-01T00:00:00Z", endsAt: "2099-12-31T23:59:59Z",
      status: "ACTIVE", agreementStatus: "SIGNED", paymentStatus: "PAID", classroomLimit: 1, userLimit: 1,
    };
    const subscription = await s.saveSubscription(admin, contractData);
    await expect(s.saveSubscription(admin, { ...contractData, reference: "OVERLAP-" + suffix })).rejects.toThrow(/overlap/);
    const institutions = await Promise.all(["A", "B"].map((name) => s.saveInstitution(admin, {
      organizationId: o.id, name: `School ${name} ${suffix}`, registration: name + suffix, boards: ["CBSE", "ICSE"], logo: "https://example.com/test.png",
    })));
    const years = await Promise.all(institutions.map((i) => s.createYear(admin, i.id, { label: "2026–27", start: "2026-04-01", end: "2027-03-31" })));
    const configs = await Promise.all(years.map((y) => s.config(admin, y.id)));
    for (const r of configs) r.config.boards[0].grades.push({ id: randomUUID(), name: "Grade 1", active: true, sectionId: null, classrooms: [{ id: randomUUID(), name: "1A", active: false }] });
    const attempts = await Promise.allSettled(years.map((y, n) => s.saveConfig(admin, y.id, { config: configs[n].config, lock: 0 })));
    expect(attempts.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((r) => r.status === "rejected")).toHaveLength(1);
    let usage = (await s.usage(admin)).find((r) => r.organizationId === o.id)!;
    expect(usage.used).toBe(1);
    expect(usage.remaining).toBe(0);
    const winner = attempts.findIndex((r) => r.status === "fulfilled");
    const chosenYear = years[winner], chosenInstitution = institutions[winner];
    let record = await s.config(admin, chosenYear.id);
    await s.publish(admin, chosenYear.id, { lock: record.revision.lock, summary: "Shared pool published" });
    const copy = await s.createYear(admin, chosenInstitution.id, { label: "2027–28", start: "2027-04-01", end: "2028-03-31", copyFrom: chosenYear.id });
    usage = (await s.usage(admin)).find((r) => r.organizationId === o.id)!;
    expect(usage.used).toBe(1); // Historical/copy snapshots are never summed.
    await s.saveSubscription(admin, { ...contractData, classroomLimit: 0 }, subscription.id);
    usage = (await s.usage(admin)).find((r) => r.organizationId === o.id)!;
    expect(usage.overLimit).toBe(true);
    expect(usage.used).toBe(1);
    await s.draft(admin, chosenYear.id, {}); // An identical edit draft remains allowed.
    record = await s.config(admin, chosenYear.id);
    const edited = structuredClone(record.config);
    edited.boards[0].grades[0].classrooms[0].name = "Renamed existing room";
    await s.saveConfig(admin, chosenYear.id, { config: edited, lock: record.revision.lock });
    await s.publish(admin, chosenYear.id, { lock: record.revision.lock + 1, summary: "Edit after reduction" });
    const copyRecord = await s.config(admin, copy.id);
    const extra = structuredClone(copyRecord.config);
    extra.boards[1].grades.push({ id: randomUUID(), name: "Grade 1", active: true, sectionId: null, classrooms: [{ id: randomUUID(), name: "ICSE 1A", active: true }] });
    await expect(s.saveConfig(admin, copy.id, { config: extra, lock: copyRecord.revision.lock })).rejects.toThrow(/limit/);
    await expect(s.createYear(admin, chosenInstitution.id, { label: "2028–29", start: "2028-04-01", end: "2029-03-31", copyFrom: chosenYear.id })).rejects.toThrow(/limit/);
    const removed = structuredClone(copyRecord.config);
    removed.boards[0].grades[0].classrooms = [];
    await s.saveConfig(admin, copy.id, { config: removed, lock: copyRecord.revision.lock });
    expect((await s.config(admin, copy.id)).config.boards[0].grades[0].classrooms).toHaveLength(0);
    await s.institutionAction(admin, chosenInstitution.id, { action: "deactivate" });
    expect((await s.usage(admin)).find((r) => r.organizationId === o.id)?.used).toBe(1);
    await s.institutionAction(admin, chosenInstitution.id, { action: "reactivate" });
    const foreign: Actor = { ...admin, role: "ORG_ADMIN", organizationId: randomUUID() };
    await expect(s.preview(foreign, chosenYear.id, { board: record.config.boards[0], dates: ["2026-11-14"] })).rejects.toThrow();
    const preview = await s.preview(admin, chosenYear.id, { board: record.config.boards[0], dates: ["2026-11-14"] });
    expect(preview[0].results[0].status).toBe("inactive");
    await s.saveSubscription(admin, { ...contractData, classroomLimit: 2 }, subscription.id);
    const oldest = (await s.history(admin, chosenYear.id)).find((r) => r.sequence === 1)!;
    await s.draft(admin, chosenYear.id, {});
    const current = await s.config(admin, chosenYear.id);
    current.config.boards[0].grades[0].classrooms = [];
    await s.saveConfig(admin, chosenYear.id, { config: current.config, lock: current.revision.lock });
    await s.publish(admin, chosenYear.id, { lock: current.revision.lock + 1, summary: "Release classrooms" });
    const loser = winner === 0 ? 1 : 0;
    const other = await s.config(admin, years[loser].id);
    const twoRooms = structuredClone(configs[loser].config);
    twoRooms.boards[1].grades.push({ id: randomUUID(), name: "Grade 1", sectionId: null, active: true, classrooms: [{ id: randomUUID(), name: "1A", active: true }] });
    await s.saveConfig(admin, years[loser].id, { config: twoRooms, lock: other.revision.lock });
    expect((await s.usage(admin)).find((r) => r.organizationId === o.id)?.used).toBe(2);
    await expect(s.draft(admin, chosenYear.id, { restoreRevisionId: oldest.id })).rejects.toThrow(/limit/);
    expect((await s.config(admin, chosenYear.id)).year.draftRevisionId).toBe(null);

  });
  it("completes onboarding, protects tenants, enforces entitlements and versions drafts", async () => {
    const suffix = randomUUID().slice(0, 8);
    const o = await s.saveOrg(admin, {
      name: "Integration " + suffix,
      legalName: "Integration Trust",
      type: "Society",
      registration: suffix,
      address: "1 Test Road",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411001",
      contactName: "Test Administrator",
      phone: "9999999999",
      email: `integration-${suffix}@example.com`,
    });
    created.push(o.id);
    const i = await s.saveInstitution(admin, {
      organizationId: o.id,
      name: "Test School",
      registration: suffix,
      boards: ["CBSE", "ICSE"],
      logo: "https://example.com/fictional-test-logo.png",
      officer: "Test Officer",
      phone: "9999999999",
      email: `school-${suffix}@example.com`,
    });
    await expect(s.onboarding(admin, o.id, { step: 2 })).rejects.toThrow();
    await s.saveSubscription(admin, {
      organizationId: o.id,
      reference: "TEST-" + suffix,
      amount: 10000,
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2030-03-31T23:59:59Z",
      status: "ACTIVE",
      agreementStatus: "SIGNED",
      paymentStatus: "PAID",
      classroomLimit: 1, userLimit: 1,
    });
    for (let step = 1; step <= 5; step++)
      await s.onboarding(admin, o.id, { step });
    const credentials = await s.activate(admin, o.id);
    const user = await db.user.findUniqueOrThrow({
      where: { organizationId: o.id },
    });
    expect(await verify(user.passwordHash, credentials.temporaryPassword)).toBe(
      true,
    );
    expect(user.mustChangePassword).toBe(true);
    await expect(s.activate(admin, o.id)).rejects.toThrow(/Already activated/);
    const rotated = await s.activate(admin, o.id, true);
    const rotatedUser = await db.user.findUniqueOrThrow({ where: { organizationId: o.id } });
    expect(rotatedUser.id).toBe(user.id);
    expect(await verify(rotatedUser.passwordHash, credentials.temporaryPassword)).toBe(false);
    expect(await verify(rotatedUser.passwordHash, rotated.temporaryPassword)).toBe(true);
    expect(await db.user.count({ where: { organizationId: o.id } })).toBe(1);

    const client: Actor = {
      id: user.id,
      role: "ORG_ADMIN",
      organizationId: o.id,
      mustChangePassword: false,
    };
    const outsider: Actor = { ...client, organizationId: randomUUID() };
    await expect(s.institution(outsider, i.id)).rejects.toThrow();
    await expect(
      s.saveOrg(client, { name: "Forbidden", email: "forbidden@example.com" }),
    ).rejects.toThrow();
    const settings = await s.settings(admin);
    await expect(
      s.saveSettings(client, {
        values: defaultPlatformSettings,
        lock: settings.lock,
      }),
    ).rejects.toThrow(/Super Admin/);
    await s.saveSettings(admin, {
      values: {
        ...defaultPlatformSettings,
        supportNotes: "Integration support",
        defaultClassroomLimit: 17,
      },
      lock: settings.lock,
    });
    await expect(
      s.saveSettings(admin, {
        values: defaultPlatformSettings,
        lock: settings.lock,
      }),
    ).rejects.toThrow(/changed elsewhere/);
    expect((await s.publicSettings()).supportNotes).toBe("Integration support");
    await expect(
      s.bulkStatus(admin, "organizations", {
        ids: [o.id, randomUUID()],
        status: "INACTIVE",
      }),
    ).rejects.toThrow();
    expect(
      (await db.organization.findUniqueOrThrow({ where: { id: o.id } })).status,
    ).toBe("ACTIVE");
    await s.bulkStatus(admin, "institutions", {
      ids: [i.id],
      status: "INACTIVE",
    });
    await expect(s.institution(client, i.id)).rejects.toThrow();
    await s.bulkStatus(admin, "institutions", {
      ids: [i.id],
      status: "ACTIVE",
    });
    const request = await s.request(client, {
      institutionId: i.id,
      proposed: { phone: "9999988888", address: "Approved new address" },
      reason: "Update registration contact details",
    });
    await expect(
      s.resolveRequest(client, request.id, {
        approve: true,
        resolution: "Forbidden",
      }),
    ).rejects.toThrow();
    await s.resolveRequest(admin, request.id, {
      approve: true,
      resolution: "Verified with institution",
    });
    expect((await s.institution(client, i.id)).phone).toBe("9999988888");
    const overview = await s.onboardingOverview(admin);
    expect(overview.find((r) => r.id === o.id)?.progress).toBeGreaterThan(50);
    const y = await s.createYear(client, i.id, {
      label: "2026–27",
      start: "2026-04-01",
      end: "2027-03-31",
    });
    let r = await s.config(client, y.id);
    expect(r.config.boards.length).toBe(2);
    const cfg = structuredClone(r.config);
    cfg.boards[0].grades = [
      {
        id: randomUUID(),
        name: "Grade 1",
        active: true,
        sectionId: null,
        classrooms: [{ id: randomUUID(), name: "Grade 1A", active: false }],
      },
    ];
    await s.saveConfig(client, y.id, { config: cfg, lock: 0 });
    const tooMany = structuredClone(cfg);
    tooMany.boards[0].grades[0].classrooms.push({
      id: randomUUID(),
      name: "Grade 1B",
      active: true,
    });
    await expect(
      s.saveConfig(client, y.id, { config: tooMany, lock: 1 }),
    ).rejects.toThrow(/limit/);
    await s.publish(client, y.id, { lock: 1, summary: "Initial structure" });
    r = await s.config(client, y.id);
    const firstId = r.revision.id;
    await s.draft(client, y.id, {});
    const d = await s.config(client, y.id);
    await expect(s.discard(client, y.id, { lock: d.revision.lock, revisionId: randomUUID() })).rejects.toThrow(/replaced/);
    const { writeConfig } = await import("../apps/api/src/store");
    await expect(db.$transaction((tx) => writeConfig(tx, firstId, d.config))).rejects.toThrow(/published|Published|working draft/);
    const changed = structuredClone(d.config);
    changed.boards[0].grades[0].name = "Renamed grade";
    await s.saveConfig(client, y.id, { config: changed, lock: 0 });
    expect((await readConfig(db, firstId)).boards[0].grades[0].name).toBe(
      "Grade 1",
    );
    await expect(
      s.saveConfig(client, y.id, { config: changed, lock: 0 }),
    ).rejects.toThrow(/changed elsewhere/);
    await s.publish(client, y.id, { lock: 1, summary: "Rename" });
    expect((await s.history(client, y.id)).length).toBe(2);
    await s.draft(client, y.id, { restoreRevisionId: firstId });
    const restored = await s.config(client, y.id);
    expect(restored.revision.id).not.toBe(firstId);
    expect(restored.config.boards[0].grades[0].name).toBe("Grade 1");
    expect(restored.published?.boards[0].grades[0].name).toBe("Renamed grade");
    await expect(s.discard(client, y.id, { lock: restored.revision.lock + 1, revisionId: restored.revision.id })).rejects.toThrow(/newer changes/);
    await s.discard(client, y.id, { lock: restored.revision.lock, revisionId: restored.revision.id });
    expect((await s.config(client, y.id)).config.boards[0].grades[0].name).toBe("Renamed grade");
    const copied = await s.createYear(client, i.id, {
      label: "2027–28",
      start: "2027-04-01",
      end: "2028-03-31",
      copyFrom: y.id,
    });
    expect(
      (await s.config(client, copied.id)).config.boards[0].grades[0].name,
    ).toBe("Renamed grade");
    await s.institutionAction(admin, i.id, {
      action: "delete",
      confirmation: i.name,
    });
    await expect(s.institution(client, i.id)).rejects.toThrow();
    const { reconcileDeletions: reconcileBeforeDeadline } = await import("../apps/api/src/main");
    await reconcileBeforeDeadline();
    expect(await db.institution.count({ where: { id: i.id } })).toBe(1);
    await s.institutionAction(admin, i.id, { action: "restore" });
    expect((await s.institution(client, i.id)).name).toBe(i.name);
    const { reconcileDeletions } = await import("../apps/api/src/main");
    await s.institutionAction(admin, i.id, {
      action: "delete",
      confirmation: i.name,
    });
    await db.institution.update({
      where: { id: i.id },
      data: { deletionDueAt: new Date(Date.now() - 1000), legalHold: true },
    });
    await reconcileDeletions();
    expect(await db.institution.count({ where: { id: i.id } })).toBe(1);
    await expect(
      s.institutionAction(admin, i.id, { action: "restore" }),
    ).rejects.toThrow(/ended/);
    await db.institution.update({
      where: { id: i.id },
      data: { legalHold: false },
    });
    await reconcileDeletions();
    await reconcileDeletions();
    expect(await db.institution.count({ where: { id: i.id } })).toBe(0);
    expect(
      await db.academicYear.count({ where: { institutionId: i.id } }),
    ).toBe(0);
  });
});
