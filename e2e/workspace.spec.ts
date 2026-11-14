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
  const note = page.getByLabel("Support information");
  await note.fill("Unpublished support note " + randomUUID());
  await section(page, "Organizations");
  const guard = page.getByRole("dialog", { name: "Unsaved changes" });
  await expect(guard).toBeVisible();
  await guard.getByRole("button", { name: "Discard & continue" }).click();
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
    .getByLabel("Temporary / current password")
    .fill(credentials.temporaryPassword);
  await page.getByLabel("New password").fill("BrowserClientPassword!2026");
  await page.getByRole("button", { name: "Set password & continue" }).click();
  await expect(
    page.getByRole("heading", { name: org.name, exact: true }),
  ).toBeVisible();
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
  await page.getByRole("row").filter({ hasText: name }).getByRole("button", { name: /Open school/ }).click();
  await page.getByRole("button", { name: /Bell Time & Calendar/ }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  let modal = page.getByRole("region", { name: "Bell schedule" });
  await modal.locator('input[aria-label="Start time"]').nth(1).fill("08:30");
  await expect(modal.getByText(/P2 overlaps P1/)).toBeVisible();
  await expect(modal.locator(".slot-row.invalid-slot")).toHaveCount(2);
  await modal.getByRole("button", { name: "Back to workspace" }).click();
  const guard = page.getByRole("dialog", { name: "Unsaved changes" });
  await guard.getByRole("button", { name: "Save & continue" }).click();
  await expect(modal).not.toBeVisible();
  const stored = await call(page, `/years/${year.id}/config`);
  expect(stored.config.boards[0].schedules[0].slots[1].start).toBe(510);
  await page.getByRole("button", { name: /Review & activate/ }).click();
  let review = page.getByRole("region", { name: "Review your configuration" });
  await expect(review.getByText(/overlap with preceding slot/)).toBeVisible();
  await review.getByRole("button", { name: "Publish configuration" }).click();
  await expect(review.getByText("Resolve blocking errors first")).toBeVisible();
  expect(
    (await call(page, `/years/${year.id}/config`)).year.publishedRevisionId,
  ).toBeNull();
  await review.getByRole("button", { name: "Back to workspace" }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  modal = page.getByRole("region", { name: "Bell schedule" });
  await modal.locator('input[aria-label="Start time"]').nth(1).fill("09:00");
  await modal.getByRole("button", { name: "Save schedule to draft" }).click();
  await page.getByRole("button", { name: /Review & activate/ }).click();
  review = page.getByRole("region", { name: "Review your configuration" });
  await review.getByRole("button", { name: "Publish configuration" }).click();
  await expect(review).not.toBeVisible();
  expect((await call(page, `/years/${year.id}/config`)).revision.status).toBe(
    "ACTIVE",
  );
  await page.getByRole("button", { name: "Year summary", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Academic year totals", exact: true })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Working days", exact: true })).toBeVisible();
  await section(page, "Academic Years");
  await expect(page.getByRole("heading", { name: `Academic years · ${name}`, exact: true })).toBeVisible();
  await section(page, "Review & History");
  await page.getByRole("button", { name: "View published versions", exact: true }).click();
  await expect(page.getByRole("region", { name: "Published version history", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back to workspace", exact: true }).click();
  await section(page, "Account & Subscription");
  await expect(page.getByRole("heading", { name: "Account & subscription", exact: true })).toBeVisible();
  await expect(page.getByText("BROWSER-" + suffix, { exact: true })).toBeVisible();
  await section(page, "Structure Management");
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Academic year", exact: true })).toHaveValue(year.id);
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
