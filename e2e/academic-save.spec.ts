import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { emptyConfig } from "../packages/domain/src";

// Browser-only fixtures test the direct-save flow without changing user records.
test("academic setup applies directly, displays validation errors, and keeps editors in page flow", async ({ page }) => {
  const schoolId = randomUUID(), yearId = randomUUID();
  const school = { id: schoolId, name: "Greenfield Academy", registration: "SCH-001", status: "ACTIVE", boards: ["CBSE"], structureStatus: "ACTIVE", logo: "", years: [] };
  const year = { id: yearId, label: "2026–27", startsAt: "2026-04-01T00:00:00.000Z", endsAt: "2027-03-31T00:00:00.000Z", draftRevisionId: randomUUID() };
  let config = emptyConfig(["CBSE"], randomUUID);
  const sectionId = randomUUID();
  config.boards[0].sections = [{ id: sectionId, name: "Primary" }];
  config.boards[0].grades = [{ id: randomUUID(), name: "Grade 1", active: true, sectionId: null, classrooms: [] }];
  const license = { used: 0, limit: 40, institutions: [], contractId: randomUUID(), users: 1, userLimit: 5 };
  let lock = 0, published: unknown = null, applications = 0, rejectSave = true;
  const calls: string[] = [];
  await page.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname.replace("/api", "");
    calls.push(`${request.method()} ${path}`);
    if (path.endsWith("/publish")) {
      applications++;
      if (rejectSave) return route.fulfill({ status: 400, json: { message: "Resolve blocking errors before publication", issues: [{ severity: "error", message: "Add a bell schedule before applying." }] } });
      published = config;
      return route.fulfill({ json: { status: "ACTIVE" } });
    }
    if (path.endsWith("/config") && request.method() === "PUT") { config = request.postDataJSON().config; return route.fulfill({ json: { lock: ++lock, license } }); }
    if (path.endsWith("/preview")) return route.fulfill({ json: (request.postDataJSON()?.dates || []).map((date: string) => ({ date, status: "missing", results: [] })) });
    const fixtures: Record<string, unknown> = {
      "/auth/me": { user: { id: "preview-client", name: "Taylor Morgan", organizationName: "Greenfield Education Trust", email: "preview@example.test", role: "ORG_ADMIN", mustChangePassword: false }, csrf: "preview" },
      "/institutions": [school], "/requests": [], "/usage": [], "/workspace-settings": {}, "/organization-profile": {},
      [`/institutions/${schoolId}/years`]: [year],
      [`/years/${yearId}/config`]: { year, config, published, revision: { id: year.draftRevisionId, status: "DRAFT", lock }, license },
    };
    await route.fulfill({ json: fixtures[path] ?? {} });
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/?page=Structure+Management&school=${schoolId}&workflow=schoolWorkspace&year=${yearId}`);
  await expect(page.getByRole("heading", { name: school.name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save & apply", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Review &|Review draft|Approve/ })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Review & History" })).toHaveCount(0);
  await page.getByRole("button", { name: "Save & apply", exact: true }).click();
  await expect(page.locator('.notice.error[role="alert"]')).toContainText("Add a bell schedule before applying.");
  expect(applications).toBe(1);
  rejectSave = false;
  await page.getByRole("button", { name: "Save & apply", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Configuration saved and applied.");
  expect(applications).toBe(2);
  expect(calls.some(call => call.endsWith("/review"))).toBe(false);
  for (const tab of ["School Registration", "Academic Sections", "Classroom Setup", "Bell Time & Calendar"]) {
    await page.locator(".structure-tabs").getByRole("button", { name: new RegExp(tab) }).click();
    if (tab === "Academic Sections") {
      await page.getByRole("combobox", { name: "Assign Grade 1 to section", exact: true }).selectOption(sectionId);
      await expect(page.locator(".notice.success")).toContainText("1 grade assigned to Primary.");
      await expect(page.getByRole("button", { name: "Confirm assignment", exact: true })).toHaveCount(0);
      await page.getByRole("button", { name: "Undo assignment", exact: true }).click();
      await expect(page.getByRole("combobox", { name: "Assign Grade 1 to section", exact: true })).toHaveValue("");
      await expect(page.locator(".save-state")).toContainText("Saved");
    }
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const overflow = await page.evaluate(() => ({ width: innerWidth, actual: document.documentElement.scrollWidth, elements: Array.from(document.querySelectorAll(".main *")).filter(el => el.getBoundingClientRect().right > innerWidth + 1).slice(0,6).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width })) }));
      expect(overflow.actual, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.width);
      await page.evaluate(() => scrollTo(0,0));
      if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/setup-${tab.toLowerCase().replace(/[^a-z]+/g,"-")}-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByRole("button", { name: /1 · Default Bell Timing/ }).click();
  await page.getByRole("button", { name: "Add schedule", exact: true }).click();
  await expect(page.getByRole("region", { name: "Bell schedule", exact: true })).toBeVisible();
  expect(await page.locator(".workflow-page").evaluate(el => getComputedStyle(el).position)).toBe("relative");
  await expect(page.getByRole("heading", { name: school.name, exact: true })).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("live academic configuration applies with validation and no approval screen", async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, "Requires disposable database credentials");
  const origin = new URL(process.env.E2E_WEB_URL || "http://localhost:3000").origin;
  async function call(path: string, method = "GET", data?: unknown) {
    const me = await page.request.get("/api/auth/me");
    const csrf = me.ok() ? (await me.json()).csrf : "";
    const response = await page.request.fetch("/api" + path, { method, data, headers: { Origin: origin, "x-csrf-token": csrf } });
    expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(true);
    return response.json();
  }
  await call("/auth/login", "POST", { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD, portal: "platform" });
  const suffix = randomUUID().slice(0,8);
  const org = await call("/organizations", "POST", { name: `Direct Save ${suffix}`, legalName: "Test Trust", email: `direct-${suffix}@example.com`, contactName: "Test Administrator", phone: "9999999999", address: "Test Road", city: "Pune", state: "Maharashtra", postalCode: "411001" });
  const school = await call("/institutions", "POST", { organizationId: org.id, name: `Direct Save School ${suffix}`, registration: suffix, boards: ["CBSE"], logo: "https://example.com/test.png", officer: "Test Officer", phone: "9999999999", email: `school-${suffix}@example.com` });
  await call("/subscriptions", "POST", { organizationId: org.id, reference: `DIRECT-${suffix}`, amount: 1000, startsAt: new Date(Date.now()-86400000).toISOString(), endsAt: new Date(Date.now()+370*86400000).toISOString(), status: "ACTIVE", agreementStatus: "SIGNED", paymentStatus: "PAID", classroomLimit: 10, userLimit: 1 });
  for(let step=1;step<=5;step++) await call(`/organizations/${org.id}/onboarding`, "POST", { step });
  const credentials = await call(`/organizations/${org.id}/activate`, "POST", {});
  await call("/auth/logout", "POST", {});
  await call("/auth/login", "POST", { email: credentials.email, password: credentials.temporaryPassword, portal: "organization" });
  await call("/auth/password", "POST", { currentPassword: credentials.temporaryPassword, password: "DirectSavePassword!2026" });
  const year = await call(`/institutions/${school.id}/years`, "POST", { label: "2026–27", start: "2026-01-01", end: "2026-12-31" });
  const snapshot = await call(`/years/${year.id}/config`);
  const board = snapshot.config.boards[0];
  const sectionId = randomUUID();
  board.sections = [{ id: sectionId, name: "Primary" }];
  board.grades = [{ id: randomUUID(), name: "Grade 1", active: true, sectionId, classrooms: [{ id: randomUUID(), name: "1A", active: true }] }];
  board.schedules = [{ id: randomUUID(), name: "Regular day", arrival: 480, dispersal: 600, target: { scope: "board", ids: [] }, rule: { type: "default", weekdays: [], intervalWeeks: 1 }, slots: [{ id: randomUUID(), name: "P1", kind: "period", start: 480, end: 540 }, { id: randomUUID(), name: "P2", kind: "period", start: 530, end: 600 }] }];
  await call(`/years/${year.id}/config`, "PUT", { config: snapshot.config, lock: snapshot.revision.lock, revisionId: snapshot.revision.id });
  await page.goto(`/?page=Structure+Management&school=${school.id}&workflow=schoolWorkspace&year=${year.id}`);
  await page.getByRole("button", { name: "Save & apply", exact: true }).click();
  await expect(page.locator('.notice.error[role="alert"]')).toBeVisible();
  expect((await call(`/years/${year.id}/config`)).published).toBeNull();
  const invalid = await call(`/years/${year.id}/config`);
  invalid.config.boards[0].schedules[0].slots[1].start = 540;
  await call(`/years/${year.id}/config`, "PUT", { config: invalid.config, lock: invalid.revision.lock, revisionId: invalid.revision.id });
  await page.reload();
  await page.getByRole("button", { name: "Save & apply", exact: true }).click();
  await expect(page.locator('.toast[role="status"]')).toContainText("Configuration saved and applied.");
  const applied = await call(`/years/${year.id}/config`);
  expect(applied.published.boards[0].grades[0].name).toBe("Grade 1");
  expect(applied.published.boards[0].schedules[0].slots[1].start).toBe(540);
  await expect(page.getByRole("button", { name: /Review &|Review draft|Approve/ })).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".structure-tabs")).toBeVisible();
  expect((await call(`/years/${year.id}/config`)).published.boards[0].grades[0].name).toBe("Grade 1");
});
