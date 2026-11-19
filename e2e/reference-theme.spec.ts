import { test, expect } from "@playwright/test";

// Presentation and navigation checks run independently of a local database.
// Records here are browser-only fixtures, never written to the application.
test("reference theme supports navigation, search, forms and responsive widths", async ({ page }) => {
  const organizations = [
    { id: "preview-org", name: "Greenfield Education Trust", email: "preview@example.test", type: "Education trust", status: "ACTIVE", progress: 100, updatedAt: "2026-11-17T10:00:00Z", _count: { institutions: 2 } },
    { id: "preview-draft", name: "Oakwood Learning Group", email: "oakwood@example.test", type: "Society", status: "ONBOARDING", progress: 45, updatedAt: "2026-11-16T10:00:00Z", _count: { institutions: 1 } },
  ];
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/api", "");
    const fixtures: Record<string, unknown> = {
      "/auth/me": { user: { id: "preview", name: "Taylor Morgan", email: "preview@example.test", role: "PLATFORM_ADMIN", mustChangePassword: false }, csrf: "preview" },
      "/organizations": organizations,
      "/institutions": [], "/subscriptions": [], "/requests": [], "/audit": [], "/usage": [],
      "/dashboard": { total: 2, active: 1, onboarding: 1, inactive: 0, recent: organizations },
      "/onboarding": [], "/workspace-settings": {},
      "/settings": { lock: 0, values: { boardCatalog: ["CBSE"], supportNotes: "", defaultClassroomLimit: 40 } },
    };
    await route.fulfill({ json: fixtures[path] ?? {} });
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  const headerTop = await page.locator(".suite-bar").evaluate(el => el.getBoundingClientRect().top);
  await page.evaluate(() => scrollTo(0, 400));
  expect(await page.locator(".suite-bar").evaluate(el => el.getBoundingClientRect().top)).toBeLessThan(headerTop);
  await page.evaluate(() => scrollTo(0, 0));
  for (const width of [1440, 1280, 1024, 901, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/dashboard-${width}.png`, fullPage: true });
  }
  await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Organizations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const section of ["Organizations", "Schools", "Onboarding", "Subscriptions", "Requests & Settings"]) {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: section, exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: section, exact: true })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/${section.toLowerCase().replace(/[^a-z]+/g, "-")}.png`, fullPage: true });
  }
  const search = page.getByRole("combobox", { name: "Search workspace" });
  await search.fill("Organizations");
  await search.press("Enter");
  await expect(page.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add organization", exact: true }).click();
  await expect(page.getByLabel("Organization name", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Organizations", exact: true })).not.toBeVisible();
  expect(await page.locator(".workflow-page").evaluate(el => getComputedStyle(el).position)).toBe("relative");
  expect(await page.evaluate(() => scrollY)).toBe(0);
  expect(await page.locator("body").evaluate(el => getComputedStyle(el).overflowY)).not.toBe("hidden");
  await page.getByRole("button", { name: "Create organization draft", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Create organization draft", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => scrollTo(0,0));
  if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/organization-form.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Organization name", { exact: true }).fill("Retained organization input");
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Schools", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Schools", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Organizations", exact: true }).click();
  await page.getByRole("button", { name: "Add organization", exact: true }).click();
  await expect(page.getByLabel("Organization name", { exact: true })).toHaveValue("Retained organization input");
  expect(errors).toEqual([]);
});

test("sign-in keeps both workspace choices usable on desktop and mobile", async ({ page }) => {
  await page.route("**/api/auth/me", route => route.fulfill({ status: 401, json: { message: "Not signed in" } }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to PLAN." })).toBeVisible();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "Organization", exact: true }).click();
    await expect(page.getByRole("button", { name: "Organization", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel("Email address")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/login-${width}.png`, fullPage: true });
  }
});

test("organization pages and school detail tabs keep the shared layout usable", async ({ page }) => {
  const school = { id: "preview-school", name: "Greenfield Academy", registration: "SCH-001", status: "ACTIVE", structureStatus: "NOT_STARTED", boards: ["CBSE"], years: [], classroomCount: 0, lastUpdated: "2026-11-17T10:00:00Z" };
  const metrics = { NOT_STARTED: 1, DRAFT: 0, INCOMPLETE_ACTIVE: 0, ACTIVE: 0, DRAFT_CHANGES_PENDING: 0, EDITING_DRAFT_NO_CHANGES: 0, total: 1, configured: 0, inProgress: 1, pending: 0, totalClassrooms: 0, activeClassroomFlags: 0, operationallyActiveClassrooms: 0 };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/api", "");
    const fixtures: Record<string, unknown> = {
      "/auth/me": { user: { id: "preview-client", name: "Taylor Morgan", organizationName: "Greenfield Education Trust", email: "preview@example.test", role: "ORG_ADMIN", mustChangePassword: false }, csrf: "preview" },
      "/institutions": [school], "/requests": [], "/usage": [], "/workspace-settings": {}, "/organization-profile": { name: "Greenfield Education Trust", subscriptions: [] },
      "/client-portal": { metrics, license: { used: 0, limit: 40, users: 1, userLimit: 5 }, subscriptions: [], attention: [], activity: [], rows: [school], boards: ["CBSE"], total: 1, page: 1, pageSize: 12 },
      "/institutions/preview-school/portal": { school, status: "NOT_STARTED", boards: [], history: [], counts: {}, year: null, basis: "Current academic year", hasCalendar: false, hasGrades: false },
    };
    await route.fulfill({ json: fixtures[path] ?? {} });
  });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Greenfield Education Trust", exact: true })).toBeVisible();
  if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/client-overview.png`, fullPage: true });
  for (const section of ["Schools", "Structure Management", "Account & Subscription"]) {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: section, exact: true }).click();
    await expect(page.getByRole("heading", { name: section === "Account & Subscription" ? "Account & subscription" : section, exact: true })).toBeVisible();
    if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/client-${section.toLowerCase().replace(/[^a-z]+/g, "-")}.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Schools", exact: true }).click();
  await page.getByRole("button", { name: "Open School", exact: true }).click();
  await expect(page.getByRole("heading", { name: school.name, exact: true })).toBeVisible();
  for (const tab of ["School Overview", "Academic Structure", "Bell Time & Calendar"]) {
    await page.getByRole("navigation", { name: "School details sections" }).getByRole("button", { name: tab, exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/client-school-details.png`, fullPage: true });
  expect(errors).toEqual([]);
});
