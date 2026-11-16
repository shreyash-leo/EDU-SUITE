import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.E2E_BASE_URL;
test(
  "Real HTTP: platform onboarding → temporary login → client structure → tenant boundary",
  { skip: !base },
  async () => {
    const origin = new URL(base).origin;
    function client() {
      let cookie = "",
        csrf = "";
      return {
        async request(path, method = "GET", body, extraHeaders = {}) {
          const r = await fetch(base + path, {
            method,
            headers: {
              "Content-Type": "application/json",
              Origin: origin,
              ...(cookie ? { Cookie: cookie } : {}),
              ...(csrf ? { "x-csrf-token": csrf } : {}),
              ...extraHeaders,
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
          const setCookie = r.headers.get("set-cookie");
          if (setCookie) cookie = setCookie.split(";")[0];
          const data = await r.json();
          if (data.csrf) csrf = data.csrf;
          if (!r.ok)
            throw Object.assign(Error(JSON.stringify(data)), {
              status: r.status,
            });
          return data;
        },
      };
    }
    const platform = client();
    const login = await platform.request("/auth/login", "POST", {
      email: process.env.E2E_ADMIN_EMAIL,
      password: process.env.E2E_ADMIN_PASSWORD,
      portal: "platform",
    });
    if (login.user.mustChangePassword) {
      if (!process.env.E2E_ADMIN_NEW_PASSWORD)
        throw Error(
          "Change the seed administrator password first, or provide E2E_ADMIN_NEW_PASSWORD for a disposable test instance",
        );
      await platform.request("/auth/password", "POST", {
        currentPassword: process.env.E2E_ADMIN_PASSWORD,
        password: process.env.E2E_ADMIN_NEW_PASSWORD,
      });
    }
    const suffix = randomUUID().slice(0, 8);
    const org = await platform.request("/organizations", "POST", {
      name: `E2E Education ${suffix}`,
      legalName: "E2E Education Trust",
      email: `org-${suffix}@example.com`,
      contactName: "Fictional Client",
      phone: "9999999999",
      address: "Test Road",
      city: "Pune",
      state: "Maharashtra",
      postalCode: "411001",
    });
    const school = await platform.request("/institutions", "POST", {
      organizationId: org.id,
      name: "E2E Test School",
      registration: suffix,
      boards: ["CBSE", "ICSE"],
      logo: "https://example.com/fictional-logo.png",
      officer: "Test Officer",
      phone: "9999999999",
      email: `school-${suffix}@example.com`,
    });
    const secondSchool = await platform.request("/institutions", "POST", {
      organizationId: org.id, name: "E2E Second School", registration: "second-" + suffix,
      boards: ["IB"], logo: "https://example.com/fictional-logo.png", officer: "Test Officer", phone: "9999999999", email: `second-${suffix}@example.com`,
    });
    await platform.request("/subscriptions", "POST", {
      organizationId: org.id,
      reference: "E2E-" + suffix,
      amount: 12500,
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: "2030-03-31T23:59:59Z",
      status: "ACTIVE",
      agreementStatus: "SIGNED",
      paymentStatus: "PAID",
      classroomLimit: 2, userLimit: 1,
    });
    for (let step = 1; step <= 5; step++)
      await platform.request(`/organizations/${org.id}/onboarding`, "POST", {
        step,
      });
    const credentials = await platform.request(
      `/organizations/${org.id}/activate`,
      "POST",
      {},
    );
    const clientPortal = client();
    const user = await clientPortal.request("/auth/login", "POST", {
      email: credentials.email,
      password: credentials.temporaryPassword,
      portal: "organization",
    });
    assert.equal(user.user.mustChangePassword, true);
    await assert.rejects(
      () => clientPortal.request("/institutions"),
      (e) => e.status === 403,
    );
    await clientPortal.request("/auth/password", "POST", {
      currentPassword: credentials.temporaryPassword,
      password: "FictionalClientPassword!2026",
    });
    const schools = await clientPortal.request("/institutions");
    assert.equal(schools.length, 2);
    assert.deepEqual(new Set(schools.map((i) => i.id)), new Set([school.id, secondSchool.id]));
    await assert.rejects(
      () => clientPortal.request("/organizations"),
      (e) => e.status === 403,
    );
    await assert.rejects(
      () => clientPortal.request(`/institutions/${randomUUID()}/years`),
      (e) => e.status === 404,
    );
    const year = await clientPortal.request(
      `/institutions/${school.id}/years`,
      "POST",
      { label: "2026–27", start: "2026-04-01", end: "2027-03-31" },
    );
    const directory = await clientPortal.request("/client-portal?pageSize=1&board=CBSE");
    const activeSchools=await clientPortal.request("/client-portal?schoolStatus=ACTIVE&board=CBSE");
    assert.equal(activeSchools.total,1);
    const inactiveSchools=await clientPortal.request("/client-portal?schoolStatus=INACTIVE");
    assert.equal(inactiveSchools.total,0);
    assert.equal(directory.total, 1); assert.equal(directory.rows[0].id, school.id);
    assert.equal(directory.rows[0].structureStatus, "DRAFT");
    assert.equal(directory.metrics.total, 2);
    assert.equal(directory.metrics.inProgress, 2);
    const details = await clientPortal.request(`/institutions/${school.id}/portal?yearId=${year.id}`);
    assert.equal(details.year.id, year.id); assert.equal(details.school.name, school.name);
    await assert.rejects(() => clientPortal.request(`/institutions/${randomUUID()}/portal`), (e) => e.status === 404);
    await assert.rejects(() => platform.request("/client-portal"), (e) => e.status === 403);
    const draft = await clientPortal.request(`/years/${year.id}/config`);
    const config = draft.config;
    assert.equal(config.boards.length, 2);
    config.boards[0].grades = [
      {
        id: randomUUID(),
        name: "Grade 1",
        active: true,
        sectionId: null,
        classrooms: [{ id: randomUUID(), name: "Grade 1A", active: true }],
      },
    ];
    const saved = await clientPortal.request(
      `/years/${year.id}/config`,
      "PUT",
      { config, lock: 0 },
    );
    await clientPortal.request(`/years/${year.id}/publish`, "POST", {
      lock: saved.lock,
      summary: "HTTP end-to-end initial activation",
    });
    await assert.rejects(()=>clientPortal.request(`/years/${year.id}/draft`,"POST",{},{"x-csrf-token":""}), e=>e.status===403);
    await assert.rejects(()=>clientPortal.request(`/years/${year.id}/draft`,"POST",{},{Origin:"https://untrusted.example"}), e=>e.status===403);
    const output = await clientPortal.request(`/years/${year.id}/published-output?start=2026-11-02&end=2026-11-02`);
    assert.equal(output.contractVersion,1); assert.equal(output.summary.validatedWorkingDays,0); assert.equal(output.summary.provisionalWorkingDays,1);
    await assert.rejects(()=>clientPortal.request(`/years/${randomUUID()}/published-output`),e=>e.status===404);
    const published = await clientPortal.request(`/years/${year.id}/config`);
    assert.equal(published.config.boards[0].grades[0].classrooms.length, 1);
    assert.equal(published.revision.status, "INCOMPLETE_ACTIVE");
    const activeDirectory = await clientPortal.request("/client-portal?status=INCOMPLETE_ACTIVE");
    assert.equal(activeDirectory.total, 1);
    assert.equal(activeDirectory.metrics.configured, 1);
    assert.equal(activeDirectory.metrics.inProgress, 1);
    assert.equal(activeDirectory.rows[0].classroomCount, 1);
    assert.ok(activeDirectory.activity.some((entry) => entry.action === "structure.published" && entry.schoolId === school.id));
    const activeDetails = await clientPortal.request(`/institutions/${school.id}/portal`);
    assert.equal(activeDetails.boards[0].grades, 1);
    assert.equal(activeDetails.history.length, 1);
    assert.equal(activeDetails.hasCalendar, false);
    const secondYear = await clientPortal.request(`/institutions/${secondSchool.id}/years`, "POST", { label: "2026–27", start: "2026-04-01", end: "2027-03-31" });
    const secondDraft = await clientPortal.request(`/years/${secondYear.id}/config`);
    secondDraft.config.boards[0].grades = [{ id: randomUUID(), name: "Grade 1", active: true, sectionId: null, classrooms: [{ id: randomUUID(), name: "1A", active: true }, { id: randomUUID(), name: "1B", active: false }] }];
    await assert.rejects(() => clientPortal.request(`/years/${secondYear.id}/config`, "PUT", { config: secondDraft.config, lock: 0 }), (e) => e.status === 400 && /limit/.test(e.message));
    secondDraft.config.boards[0].grades[0].classrooms.pop();
    await clientPortal.request(`/years/${secondYear.id}/config`, "PUT", { config: secondDraft.config, lock: 0 });
    const pool = await clientPortal.request("/usage");
    assert.equal(pool.length, 1); assert.equal(pool[0].used, 2); assert.equal(pool[0].limit, 2); assert.equal(pool[0].remaining, 0);
    const preview = await clientPortal.request(`/years/${year.id}/preview`, "POST", { board: config.boards[0], dates: ["2026-11-02"] });
    assert.equal(preview[0].results[0].status, "missing");
    await clientPortal.request(`/years/${year.id}/draft`, "POST", {});
    const edit = await clientPortal.request(`/years/${year.id}/config`);
    edit.config.boards[0].grades[0].name = "Grade One";
    const updated = await clientPortal.request(
      `/years/${year.id}/config`,
      "PUT",
      { config: edit.config, lock: edit.revision.lock },
    );
    const historical = await clientPortal.request(
      `/years/${year.id}/config?revisionId=${published.revision.id}`,
    );
    assert.equal(historical.config.boards[0].grades[0].name, "Grade 1");
    await clientPortal.request(`/years/${year.id}/publish`, "POST", {
      lock: updated.lock,
      summary: "Second publication",
    });
    assert.equal(
      (await clientPortal.request(`/years/${year.id}/history`)).length,
      2,
    );
    await platform.request(`/institutions/${school.id}/action`, "POST", {
      action: "delete",
      confirmation: school.name,
    });
    assert.equal((await clientPortal.request("/institutions")).length, 1);
    await platform.request(`/institutions/${school.id}/action`, "POST", {
      action: "restore",
    });
    assert.equal((await clientPortal.request("/institutions")).length, 2);
  },
);
