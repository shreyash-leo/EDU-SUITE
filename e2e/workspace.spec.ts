import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const origin = new URL(process.env.E2E_WEB_URL || "http://localhost:3000")
  .origin;
async function call(page: Page, path: string, method = "GET", data?: unknown) {
  const me = await page.request.get("/api/auth/me");
  const csrf = me.ok() ? (await me.json()).csrf : "";
  const r = await page.request.fetch("/api" + path, {
    method,
    data,
    headers: { Origin: origin, "x-csrf-token": csrf },
  });
  expect(r.ok(), `${method} ${path}: ${await r.text()}`).toBeTruthy();
  return r.json();
}
async function login(
  page: Page,
  email: string,
  password: string,
  portal = "Super Admin",
) {
  await page.goto("/");
  await page.getByRole("button", { name: portal, exact: true }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
}
async function section(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  test.skip(
    !process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD,
    "Provide current administrator credentials for a disposable instance",
  );
  await login(
    page,
    process.env.E2E_ADMIN_EMAIL!,
    process.env.E2E_ADMIN_PASSWORD!,
  );
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});
test("organization fields remain read-only until Edit is opened and saved", async ({ page }) => {
  const name = "Browser Trust " + randomUUID().slice(0, 8);
  const org = await call(page, "/organizations", "POST", { name, type: "Society", email: `${randomUUID()}@example.com` });
  await page.reload();
  await section(page, "Organizations");
  await page.getByRole("textbox", { name: "Search records…" }).fill(name);
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row.getByRole("textbox")).toHaveCount(0);
  await expect(row.getByRole("combobox")).toHaveCount(0);
  await expect(row).toContainText("Society");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("region", { name: "Organization registration", exact: true });
  await editor.getByLabel("Organization name").fill(name + " Updated");
  await editor.getByLabel("Organization type", { exact: true }).selectOption("Private company");
  expect((await call(page, "/organizations")).find((o: { id: string }) => o.id === org.id).name).toBe(name);
  await editor.getByRole("button", { name: "Save organization", exact: true }).click();
  await expect(editor).not.toBeVisible();
  const saved = (await call(page, "/organizations")).find((o: { id: string }) => o.id === org.id);
  expect(saved.name).toBe(name + " Updated");
  expect(saved.type).toBe("Private company");
  await page.reload();
  await section(page, "Organizations");
  await page.getByRole("textbox", { name: "Search records…" }).fill(name + " Updated");
  const updatedRow = page.getByRole("row").filter({ hasText: name + " Updated" });
  await expect(updatedRow).toContainText("Private company");
  await expect(updatedRow.getByRole("textbox")).toHaveCount(0);
});
test("platform settings require an explicit discard or a successful save", async ({
  page,
}) => {
  const before = await call(page, "/settings");
  await section(page, "Requests & Settings");
  await page.getByRole("button", { name: "Platform settings", exact: true }).click();
  const note = page.getByLabel("Support information");
  await note.fill("Unpublished support note " + randomUUID());
  await section(page, "Organizations");
  const guard = page.getByRole("dialog", { name: "Unsaved changes" });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Discard Unsaved Changes" }).click();
  await section(page, "Requests & Settings");
  await expect(page.getByLabel("Support information")).toHaveValue(
    before.values.supportNotes,
  );
  const next = "Verified browser setting " + randomUUID();
  await page.getByLabel("Support information").fill(next);
  await page.getByRole("button", { name: "Save platform settings" }).click();
  await expect(
    page.getByText("Platform settings saved", { exact: true }),
  ).toBeVisible();
  const saved = await call(page, "/settings");
  expect(saved.values.supportNotes).toBe(next);
  await call(page, "/settings", "PUT", {
    values: before.values,
    lock: saved.lock,
  });
});
test("schedule conflicts highlight both slots, survive save-and-close, and block publication until corrected", async ({
  page,
}) => {
  const suffix = randomUUID().slice(0, 8),
    name = "Browser School " + suffix;
  const org = await call(page, "/organizations", "POST", {
    name: "Browser Group " + suffix,
    legalName: "Browser Education Trust",
    address: "Test Road",
    city: "Pune",
    state: "Maharashtra",
    postalCode: "411001",
    contactName: "Test Administrator",
    phone: "9999999999",
    email: `browser-${suffix}@example.com`,
  });
  const school = await call(page, "/institutions", "POST", {
    organizationId: org.id,
    name,
    registration: suffix,
    boards: ["CBSE"],
    logo: "https://example.com/logo.png",
    officer: "Test Officer",
    phone: "9999999999",
    email: `school-${suffix}@example.com`,
  });
  await call(page, "/subscriptions", "POST", {
    organizationId: org.id,
    reference: "BROWSER-" + suffix,
    amount: 1000,
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 370 * 86400000).toISOString(),
    status: "ACTIVE",
    agreementStatus: "SIGNED",
    paymentStatus: "PAID",
    classroomLimit: 3, userLimit: 1,
  });
  for (let step = 1; step <= 5; step++)
    await call(page, `/organizations/${org.id}/onboarding`, "POST", { step });
  const credentials = await call(
    page,
    `/organizations/${org.id}/activate`,
    "POST",
    {},
  );
  await call(page, "/auth/logout", "POST", {});
  await login(
    page,
    credentials.email,
    credentials.temporaryPassword,
    "Organization",
  );
  await expect(
    page.getByRole("heading", { name: "Make this account yours." }),
  ).toBeVisible();
  await page
    .getByLabel("Temporary / current password", { exact: true })
    .fill(credentials.temporaryPassword);
  await page.getByLabel("New password", { exact: true }).fill("BrowserClientPassword!2026");
  await page.getByRole("button", { name: "Set password & continue" }).click();
  await expect(
    page.getByRole("heading", { name: org.name, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".portal-metrics")).toBeVisible();
  await page.screenshot({path: "/tmp/plan-client-overview.png", fullPage: true});
  const yearNumber = new Date().getUTCFullYear();
  const year = await call(page, `/institutions/${school.id}/years`, "POST", {
    label: `${yearNumber}–${yearNumber + 1}`,
    start: `${yearNumber}-01-01`,
    end: `${yearNumber}-12-31`,
  });
  const draft = await call(page, `/years/${year.id}/config`);
  const b = draft.config.boards[0];
  const sectionId = randomUUID();
  b.sections = [{ id: sectionId, name: "Primary" }];
  b.grades = [
    {
      id: randomUUID(),
      name: "Grade 1",
      active: true,
      sectionId,
      classrooms: [
        { id: randomUUID(), name: "1A", active: true },
        { id: randomUUID(), name: "1B", active: true },
      ],
    },
  ];
  b.schedules = [
    {
      id: randomUUID(),
      name: "Regular day",
      arrival: 480,
      dispersal: 600,
      target: { scope: "board", ids: [] },
      rule: { type: "default", weekdays: [], intervalWeeks: 1 },
      slots: [
        { id: randomUUID(), name: "P1", kind: "period", start: 480, end: 540 },
        { id: randomUUID(), name: "P2", kind: "period", start: 540, end: 600 },
      ],
    },
  ];
  await call(page, `/years/${year.id}/config`, "PUT", {
    config: draft.config,
    lock: 0,
  });
  await section(page, "Schools");
  await page.getByLabel("Search schools", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Cards", exact: true }).click();
  await expect(page.locator(".portal-school-card").filter({ hasText: name })).toBeVisible();
  await page.screenshot({path: "/tmp/plan-client-cards.png", fullPage: true});
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Open School", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "School details sections" })).toBeVisible();
  await page.screenshot({path: "/tmp/plan-client-school-details.png", fullPage: true});
  await page.getByRole("button", { name: "Continue Configuration", exact: true }).click();
  await page.getByRole("button", { name: "Add multiple grades", exact: true }).click();
  const bulkGrades = page.getByRole("region", { name: "Add multiple grades", exact: true });
  await bulkGrades.getByRole("button", { name: "Generate preview", exact: true }).click();
  await expect(bulkGrades.getByText("11 grades ready", { exact: true })).toBeVisible();
  await bulkGrades.getByRole("button", { name: "Create 11 grades", exact: true }).click();
  await expect(bulkGrades).not.toBeVisible();
  await page.reload();
  expect((await call(page, `/years/${year.id}/config`)).config.boards[0].grades).toHaveLength(12);
  await page.getByRole("button", { name: /Academic Sections/ }).click();
  await page.getByRole("complementary", { name: "Academic sections", exact: true }).getByRole("button", { name: /Primary/ }).click();
  await page.getByRole("button", { name: "Add grades", exact: true }).click();
  await page.getByRole("checkbox", { name: "Select all filtered rows", exact: true }).check();
  await page.getByRole("button", { name: "Assign selected grades", exact: true }).click();
  await page.getByRole("button", { name: "Confirm assignment", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const assigned = await call(page, `/years/${year.id}/config`);
  expect(assigned.config.boards[0].grades.every((g: { sectionId: string }) => g.sectionId === sectionId)).toBe(true);
  await page.getByRole("button", { name: /Classroom Setup/ }).click();
  await page.getByRole("button", { name: "Add multiple classrooms", exact: true }).click();
  const rooms = page.getByRole("region", { name: "Add multiple classrooms", exact: true });
  await rooms.getByRole("button", { name: "Generate editable preview", exact: true }).click();
  await rooms.getByLabel(/Classroom name /).fill("1C");
  await rooms.getByRole("button", { name: "Create 1 classroom", exact: true }).click();
  await expect(rooms).not.toBeVisible();
  expect((await call(page, `/years/${year.id}/config`)).config.boards[0].grades[0].classrooms.map((c: {name: string}) => c.name)).toContain("1C");
  const beforeBulkDelete = await call(page, `/years/${year.id}/config`);
  await page.getByRole("checkbox", { name: "Select 1B", exact: true }).check();
  await page.getByRole("checkbox", { name: "Select 1C", exact: true }).check();
  await page.getByLabel("Bulk action", { exact: true }).selectOption({ label: "Delete classrooms" });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  let deleteReview = page.getByRole("dialog", { name: "Delete classrooms", exact: true });
  await expect(deleteReview.getByText("1B · Grade 1")).toBeVisible();
  await expect(deleteReview.getByText("1C · Grade 1")).toBeVisible();
  await deleteReview.getByRole("button", { name: "Cancel", exact: true }).click();
  expect((await call(page, `/years/${year.id}/config`)).config.boards[0].grades[0].classrooms).toHaveLength(3);
  await page.getByRole("checkbox", { name: "Select 1B", exact: true }).check();
  await page.getByRole("checkbox", { name: "Select 1C", exact: true }).check();
  await page.getByLabel("Bulk action", { exact: true }).selectOption({ label: "Delete classrooms" });
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  deleteReview = page.getByRole("dialog", { name: "Delete classrooms", exact: true });
  await deleteReview.getByRole("button", { name: "Delete 2 classrooms", exact: true }).click();
  await expect.poll(async () => (await call(page, `/years/${year.id}/config`)).config.boards[0].grades[0].classrooms.map((c: {name: string}) => c.name)).toEqual(["1A"]);
  const afterBulkDelete = await call(page, `/years/${year.id}/config`);
  await call(page, `/years/${year.id}/config`, "PUT", { config: beforeBulkDelete.config, lock: afterBulkDelete.revision.lock, revisionId: afterBulkDelete.revision.id });
  await page.reload();
  await page.getByRole("button", { name: /Bell Time & Calendar/ }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  let modal = page.getByRole("region", { name: "Bell schedule" });
  await modal.locator('input[aria-label="Start time"]').nth(1).fill("08:30");
  await expect(modal.getByText(/P2 overlaps P1/)).toBeVisible();
  await expect(modal.locator(".slot-row.invalid-slot")).toHaveCount(2);
  await modal.getByRole("button", { name: "Back to workspace" }).click();
  const guard = page.getByRole("dialog", { name: "Unsaved changes" });
  await guard.getByRole("button", { name: "Save & continue" }).click();
  await expect(guard).not.toBeVisible();
  await expect(modal).not.toBeVisible();
  const stored = await call(page, `/years/${year.id}/config`);
  expect(stored.config.boards[0].schedules[0].slots[1].start).toBe(510);
  await page.getByRole("button", { name: /Review & activate/ }).click();
  let review = page.getByRole("region", { name: "Review your configuration" });
  await expect(review.getByText(/overlap with preceding slot/).first()).toBeVisible();
  await review.getByRole("button", { name: "Publish configuration" }).click();
  await expect(review.getByText("Resolve blocking errors first")).toBeVisible();
  expect(
    (await call(page, `/years/${year.id}/config`)).year.publishedRevisionId,
  ).toBeNull();
  await review.getByRole("button", { name: "Back to workspace" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  modal = page.getByRole("region", { name: "Bell schedule" });
  await modal.locator('input[aria-label="Start time"]').nth(1).fill("09:00");
  await modal.getByRole("button", { name: "Continue", exact: true }).click();
  await modal.getByRole("button", { name: "Save schedule to draft" }).click();
  await page.getByRole("button", { name: /Review & activate/ }).click();
  review = page.getByRole("region", { name: "Review your configuration" });
  await review.getByRole("button", { name: "Publish configuration" }).click();
  await expect(review).not.toBeVisible();
  expect((await call(page, `/years/${year.id}/config`)).revision.status).toBe(
    "ACTIVE",
  );
  await page.getByRole("button", { name: "Calendar & preview", exact: true }).click();
  await page.getByRole("button", { name: "Year summary", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Academic year totals", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Working days", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("button", { name: "Academic Years", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Manage academic years", exact: true }).click();
  await expect(page.getByRole("heading", { name: `Academic years · ${name}`, exact: true })).toBeVisible();
  await section(page, "Review & History");
  await page.getByLabel("Search schools", { exact: true }).fill(name);
  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Review & History", exact: true }).click();
  const historicalSnapshot = await call(page, `/years/${year.id}/config`);
  await call(page, `/years/${year.id}/draft`, "POST", {});
  const laterDraft = await call(page, `/years/${year.id}/config`);
  laterDraft.config.boards[0].grades[0].name = "Later published grade";
  const laterSaved = await call(page, `/years/${year.id}/config`, "PUT", { config: laterDraft.config, lock: laterDraft.revision.lock, revisionId: laterDraft.revision.id });
  await call(page, `/years/${year.id}/publish`, "POST", { lock: laterSaved.lock, revisionId: laterDraft.revision.id, summary: "Later publication for history refresh verification" });
  await page.getByRole("button", { name: "View published versions", exact: true }).click();
  const historicalPanel = page.getByRole("region", { name: "Published version history", exact: true });
  await expect(historicalPanel).toBeVisible();
  await historicalPanel.getByRole("button", { name: "View", exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(`revision=${historicalSnapshot.revision.id}`));
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`revision=${historicalSnapshot.revision.id}`));
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save draft", exact: true })).toHaveCount(0);
  await section(page, "Account & Subscription");
  await expect(page.getByRole("heading", { name: "Account & subscription", exact: true })).toBeVisible();
  await expect(page.getByText("BROWSER-" + suffix, { exact: true })).toBeVisible();
  await section(page, "Structure Management");
  await expect(page.getByRole("heading", { name: "Structure Management", exact: true })).toBeVisible();
  await page.getByLabel("Search schools", { exact: true }).fill(name);
  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: "Open Configuration", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Academic year", exact: true })).toHaveValue(year.id);
  await page.getByRole("button", { name: "Edit configuration", exact: true }).click();
  await page.getByRole("button", { name: /Bell Time & Calendar/ }).click();
  await page.getByRole("button", { name: "Add schedule", exact: true }).click();
  const wizard = page.getByRole("region", { name: "Bell schedule", exact: true });
  await wizard.getByLabel("Schedule name", { exact: true }).fill("Guided school default");
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await wizard.getByLabel("Student dispersal", { exact: true }).fill("10:15");
  await wizard.getByLabel("Number of teaching periods", { exact: true }).fill("2");
  await wizard.getByLabel("Default period duration (minutes)", { exact: true }).fill("60");
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await wizard.getByLabel("Routine", { exact: true }).selectOption("Assembly");
  await wizard.getByRole("button", { name: "Add routine", exact: true }).click();
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await wizard.getByRole("button", { name: "Auto Assign", exact: true }).click();
  page.once("dialog", (dialog) => { void dialog.dismiss(); });
  await wizard.locator('input[aria-label="Start time"]').first().fill("08:05");
  await expect(wizard.locator('input[aria-label="Start time"]').first()).toHaveValue("08:00");
  await wizard.getByRole("button", { name: "Continue", exact: true }).click();
  await wizard.getByRole("button", { name: "Save schedule to draft", exact: true }).click();
  await expect(wizard).not.toBeVisible();
  const newDraft = await call(page, `/years/${year.id}/config`);
  expect(newDraft.config.boards[0].schedules).toHaveLength(2);
  expect(newDraft.published.boards[0].schedules).toHaveLength(1);
  await page.getByRole("button", { name: "3 · Advanced Scheduling", exact: true }).click();
  await page.getByRole("combobox", { name: "New rule action", exact: true }).selectOption("holiday");
  await page.getByRole("button", { name: "Add rule", exact: true }).click();
  const event = page.getByRole("region", { name: "Calendar event", exact: true });
  await event.getByLabel("Event name", { exact: true }).fill("Fourth Saturday closure");
  await event.getByRole("button", { name: "Fourth Saturday", exact: true }).click();
  await event.getByRole("button", { name: "Save event to draft", exact: true }).click();
  await expect(event).not.toBeVisible();
  expect((await call(page, `/years/${year.id}/config`)).config.boards[0].events[0].rule.nth).toBe(4);
  await page.getByRole("button", {name:"Use three-part scheduling in draft",exact:true}).click();
  await expect(page.getByRole("button", {name:"Use three-part scheduling in draft",exact:true})).toHaveCount(0);
  await page.getByRole("button", {name:"2 · Default Holidays",exact:true}).click();
  await page.getByRole("button", {name:"Add holiday",exact:true}).click();
  const holiday = page.getByRole("region", {name:"Calendar event",exact:true});
  await holiday.getByLabel("Event name",{exact:true}).fill("Diwali vacation");
  await holiday.getByRole("button", {name:"Use inclusive holiday date range",exact:true}).click();
  await holiday.getByRole("button", {name:"Save event to draft",exact:true}).click();
  await expect(holiday).not.toBeVisible();
  const afterHoliday = await call(page, `/years/${year.id}/config`);
  const parent = afterHoliday.config.boards[0].events.find((e:any)=>e.name==="Diwali vacation");
  expect(parent.configurationPart).toBe("default-holidays");
  await page.getByRole("row").filter({hasText:"Diwali vacation"}).getByRole("button",{name:"Add targeted override",exact:true}).click();
  await expect(holiday.getByLabel("Parent holiday / vacation",{exact:true})).toHaveValue(parent.id);
  await holiday.getByLabel("Event name",{exact:true}).fill("Classroom vacation");
  await holiday.getByRole("checkbox",{name:/1A/}).check();
  await holiday.getByRole("button", {name:"Save event to draft",exact:true}).click();
  await expect(holiday).not.toBeVisible();
  const afterOverride=await call(page, `/years/${year.id}/config`);
  expect(afterOverride.config.resolverVersion).toBe(2);
  expect(afterOverride.config.boards[0].events.find((e:any)=>e.name==="Classroom vacation").parentId).toBe(parent.id);
  expect(afterOverride.published.resolverVersion).toBe(1);
  await page.getByRole("button", {name:"3 · Advanced Scheduling",exact:true}).click();
  await page.getByRole("combobox", {name:"New rule action",exact:true}).selectOption("schedule");
  await page.getByRole("button", {name:"Add rule",exact:true}).click();
  const timingRule=page.getByRole("region",{name:"Calendar event",exact:true});
  await timingRule.getByLabel("Event name",{exact:true}).fill("Targeted recurring timing");
  await expect(timingRule.getByLabel("What happens?",{exact:true})).toHaveValue("timing");
  await timingRule.getByLabel("Bell schedule",{exact:true}).selectOption(afterOverride.config.boards[0].schedules[0].id);
  await timingRule.getByRole("button",{name:"Save event to draft",exact:true}).click();
  await expect(timingRule).not.toBeVisible();
  const afterTiming=await call(page, `/years/${year.id}/config`);
  expect(afterTiming.config.boards[0].events.find((e:any)=>e.name==="Targeted recurring timing").operation).toBe("timing");

  await page.setViewportSize({width:1280,height:720});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.setViewportSize({width:768,height:1024});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.reload();
  await expect(page.getByRole("button",{name:"Use three-part scheduling in draft",exact:true})).toHaveCount(0);

});

test("workspace search opens sections by keyboard and preserves compact navigation", async ({ page }) => {
  const search = page.getByRole("combobox", { name: "Search workspace", exact: true });
  await search.fill("Subscriptions");
  await expect(page.getByRole("listbox", { name: "Workspace search results" })).toBeVisible();
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Subscriptions", exact: true })).toBeVisible();
  await expect(search).toHaveValue("");
  await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Expand sidebar", exact: true })).toBeVisible();
  await search.fill("Requests & Settings");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: /Requests & settings/i })).toBeVisible();
  await search.fill("no-such-record-" + randomUUID());
  await expect(page.getByText("No matching sections or records.", { exact: true })).toBeVisible();
  await search.press("Escape");
  await expect(page.getByRole("listbox", { name: "Workspace search results" })).not.toBeVisible();
  await page.getByRole("button", { name: "Expand sidebar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Collapse sidebar", exact: true })).toBeVisible();
});

test("record names open read-only information and onboarding supports list, cards and top tabs", async ({ page }) => {
  const name = "Onboarding Catalog " + randomUUID().slice(0, 8);
  const org = await call(page, "/organizations", "POST", { name, type: "Society", email: `${randomUUID()}@example.com` });
  await page.reload();
  await section(page, "Organizations");
  await page.getByRole("textbox", { name: "Search records…" }).fill(name);
  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name, exact: true }).click();
  const information = page.getByRole("region", { name, exact: true });
  await expect(page).toHaveURL(/workflow=organizationDetails/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(information).toBeVisible();
  await expect(information.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(information.getByRole("textbox")).toHaveCount(0);
  await expect(information).toContainText("Society");
  await information.getByRole("tab", { name: "Onboarding", exact: true }).click();
  await information.getByRole("button", { name: "Open onboarding", exact: true }).click();
  await expect(information).not.toBeVisible();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const steps = page.getByRole("tablist", { name: "Onboarding steps", exact: true });
  await expect(steps.getByRole("tab")).toHaveCount(7);
  await expect(steps.getByRole("tab").first()).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "All onboarding", exact: true }).click();
  await expect(page.getByRole("button", { name: "List view", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("textbox", { name: "Search onboarding", exact: true }).fill(name);
  await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(1);
  await page.getByRole("button", { name: "Card view", exact: true }).click();
  const card = page.getByRole("article").filter({ hasText: name });
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: "Start onboarding", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Onboarding steps", exact: true });
  await tabs.getByRole("tab").nth(1).click();
  await expect(tabs.getByRole("tab").nth(1)).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab").nth(1).press("ArrowRight");
  await expect(tabs.getByRole("tab").nth(2)).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "All onboarding", exact: true }).click();
  await expect(page.getByRole("button", { name: "Card view", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect((await call(page, "/organizations")).find((o: { id: string }) => o.id === org.id).name).toBe(name);
});


test("school registration manages multiple searchable board affiliations and preserves them after refresh", async ({ page }) => {
  const suffix = randomUUID().slice(0, 8), name = "Multi-board school " + suffix;
  const org = await call(page, "/organizations", "POST", { name: "Board Trust " + suffix, email: `${suffix}-boards@example.com` });
  await page.reload(); await section(page, "Schools");
  await page.getByRole("button", { name: "Add school", exact: true }).click();
  const form = page.getByRole("region", { name: "School registration", exact: true });
  await form.getByLabel("Organization", { exact: false }).selectOption(org.id);
  await form.getByLabel("School name", { exact: true }).fill(name);
  await form.getByLabel("Registration number", { exact: true }).fill("BOARDS-" + suffix);
  for (const board of ["CBSE", "ICSE"]) { await form.getByLabel("Select board", { exact: false }).fill(board); await form.getByRole("button", { name: "Add board", exact: true }).click(); }
  await form.getByLabel("Select board", { exact: false }).fill("CBSE");
  await form.getByRole("button", { name: "Add board", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("already selected");
  await form.getByLabel("Select board", { exact: false }).fill("");
  await form.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(form).not.toBeVisible(); await page.reload();
  const saved = (await call(page, "/institutions")).find((school: {name: string}) => school.name === name);
  expect(saved.boards).toEqual(["CBSE", "ICSE"]);
  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("region", { name, exact: true }).getByText("Registered boards", { exact: true })).toBeVisible();
});

test("client school inspection and configuration remain separate entry points", async ({page}) => {
  const suffix=randomUUID().slice(0,8), schoolName="Portal School "+suffix;
  const org=await call(page,"/organizations","POST",{name:"Portal Group "+suffix,legalName:"Portal Education Trust",email:`portal-${suffix}@example.com`,contactName:"Test Administrator",phone:"9999999999",address:"Test Road",city:"Pune",state:"Maharashtra",postalCode:"411001"});
  const school=await call(page,"/institutions","POST",{organizationId:org.id,name:schoolName,registration:suffix,boards:["CBSE"],logo:"https://example.com/test.png",officer:"Test Officer",phone:"9999999999",email:`school-${suffix}@example.com`});
  await call(page,"/subscriptions","POST",{organizationId:org.id,reference:"PORTAL-"+suffix,amount:1000,startsAt:new Date(Date.now()-86400000).toISOString(),endsAt:new Date(Date.now()+370*86400000).toISOString(),status:"ACTIVE",agreementStatus:"SIGNED",paymentStatus:"PAID",classroomLimit:10,userLimit:1});
  for(let step=1;step<=5;step++)await call(page,`/organizations/${org.id}/onboarding`,"POST",{step});
  const credentials=await call(page,`/organizations/${org.id}/activate`,"POST",{});
  await call(page,"/auth/logout","POST",{});
  await login(page,credentials.email,credentials.temporaryPassword,"Organization");
  await page.getByLabel("Temporary / current password", { exact: true }).fill(credentials.temporaryPassword);
  await page.getByLabel("New password", { exact: true }).fill("PortalClientPassword!2026");
  await page.getByRole("button",{name:"Set password & continue"}).click();
  await expect(page.locator(".portal-metrics")).toBeVisible();
  const directory=await call(page,"/client-portal");
  expect(directory.metrics.total).toBe(1);
  await expect(page.locator(".portal-metrics").getByRole("button",{name:/Registered schools/})).toContainText("1");
  await section(page,"Schools");
  await expect(page.getByRole("navigation").getByRole("button",{name:"Academic Years",exact:true})).toHaveCount(0);
  await page.getByLabel("School status",{exact:true}).selectOption("INACTIVE");
  await expect(page.getByText("No schools match",{exact:true})).toBeVisible();
  await page.getByLabel("School status",{exact:true}).selectOption("ACTIVE");
  const row=page.getByRole("row").filter({hasText:schoolName});
  await row.getByRole("cell",{name:"CBSE",exact:true}).click();
  await expect(page).toHaveURL(/workflow=schoolDetails/);
  await expect(page.getByRole("navigation",{name:"School details sections"})).toBeVisible();
  await expect(page.locator(".structure-tabs")).toHaveCount(0);
  await page.getByRole("button",{name:"Back to Schools",exact:true}).click();
  await page.getByRole("button",{name:"Cards",exact:true}).click();
  const card=page.locator(".portal-school-card").filter({hasText:schoolName});
  await card.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/workflow=schoolDetails/);
  await page.getByRole("navigation",{name:"School details sections"}).getByRole("button",{name:"Academic Structure",exact:true}).click();
  await page.getByRole("button",{name:"Manage Structure",exact:true}).click();
  await expect(page).toHaveURL(/workflow=schoolWorkspace/);
  await expect(page.getByText("Start your first academic year",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Create academic year",exact:true}).click();
  let yearForm=page.getByRole("region",{name:"Create academic year",exact:true});
  await yearForm.getByLabel("Academic year",{exact:true}).fill("Portal Year 1");
  await yearForm.getByRole("button",{name:"Create academic year",exact:true}).click();
  await expect(page.locator(".structure-tabs")).toBeVisible();
  const years=await call(page,`/institutions/${school.id}/years`);
  await expect(page.getByRole("combobox",{name:"Academic year",exact:true})).toHaveValue(years[0].id);
  await page.getByRole("button",{name:"Academic year",exact:true}).click();
  yearForm=page.getByRole("region",{name:"Create academic year",exact:true});
  await yearForm.getByLabel("Starting configuration").selectOption(years[0].id);
  await expect(yearForm.getByText("Copy preview",{exact:true})).toBeVisible();
  await yearForm.getByLabel("Academic year",{exact:true}).fill("Portal Year 2");
  await yearForm.getByRole("button",{name:"Create academic year",exact:true}).click();
  for(const name of ["School Registration","Academic Sections","Classroom Setup","Bell Time & Calendar"]) {
    await page.locator(".structure-tabs").getByRole("button",{name:new RegExp(name.replace("&","\\&"))}).click();
    await expect(page.locator(".structure-tabs")).toBeVisible();
  }
  await section(page,"Structure Management");
  await expect(page.getByRole("heading",{name:"Structure Management",exact:true})).toBeVisible();
  await expect(page.locator(".structure-tabs")).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Cards",exact:true})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:"Continue Configuration",exact:true}).click();
  await expect(page.locator(".structure-tabs")).toBeVisible();
  await section(page,"Schools");
  await page.getByRole("button",{name:schoolName,exact:true}).click();
  await page.getByRole("navigation",{name:"School details sections"}).getByRole("button",{name:"Bell Time & Calendar",exact:true}).click();
  await page.getByRole("button",{name:"Open Calendar",exact:true}).click();
  await expect(page).toHaveURL(/intent=calendar/);
  await expect(page.getByRole("button",{name:"Monthly calendar",exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button",{name:"Monthly calendar",exact:true})).toBeVisible();
});
