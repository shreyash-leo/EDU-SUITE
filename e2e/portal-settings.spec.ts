import { test, expect } from "@playwright/test";

for (const admin of [true, false]) test(`${admin ? "platform" : "organization"} settings work without navigation confirmation prompts`, async ({ page }) => {
  let passwordUpdates = 0, settingsUpdates = 0;
  let settings = { lock: 0, values: { boardCatalog: ["CBSE"], supportEmail: "support@example.test", supportPhone: "+919999999999", supportNotes: "Contact the platform team for registration help.", defaultClassroomLimit: 40, maintenanceNotice: "" } };
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname.replace("/api", "");
    if (path === "/auth/password") { passwordUpdates++; return route.fulfill({ json: { csrf: "updated" } }); }
    if (path === "/settings" && route.request().method() === "PUT") { settingsUpdates++; settings = { lock: settings.lock + 1, values: route.request().postDataJSON().values }; return route.fulfill({ json: settings }); }
    const fixtures: Record<string, unknown> = {
      "/auth/me": { user: { id: `settings-${admin}`, name: "Taylor Morgan", email: "taylor@example.test", organizationName: "Greenfield Education Trust", role: admin ? "PLATFORM_ADMIN" : "ORG_ADMIN", mustChangePassword: false }, csrf: "preview" },
      "/organizations": [], "/institutions": [], "/subscriptions": [], "/requests": [], "/audit": [], "/usage": [], "/onboarding": [],
      "/dashboard": { total: 0, active: 0, onboarding: 0, inactive: 0, recent: [] },
      "/settings": settings, "/workspace-settings": settings.values, "/organization-profile": { name: "Greenfield Education Trust", subscriptions: [] },
      "/client-portal": { metrics: { total: 0, configured: 0, inProgress: 0, pending: 0 }, license: { used: 0, limit: 40, users: 1, userLimit: 5 }, rows: [], boards: [], attention: [], activity: [], subscriptions: [], total: 0, page: 1, pageSize: 10 },
    };
    await route.fulfill({ json: fixtures[path] ?? {} });
  });
  const errors: string[] = [], dialogs: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => { dialogs.push(dialog.type()); void dialog.dismiss(); });
  await page.goto("/?page=Settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  const sections = page.getByRole("navigation", { name: "Settings sections" });
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(page.getByRole("heading", { name: "Your account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Account settings for Taylor Morgan", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Current password", { exact: true }).fill("CurrentPassword!2026");
  await sections.getByRole("button", { name: "Preferences", exact: true }).click();
  expect(passwordUpdates).toBe(0);
  await sections.getByRole("button", { name: "Account & security", exact: true }).click();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveValue("");
  await page.getByLabel("Current password", { exact: true }).fill("CurrentPassword!2026");
  await page.getByLabel("New password", { exact: true }).fill("NewPassword!2026");
  await page.getByLabel("Confirm new password", { exact: true }).fill("Mismatch!2026");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.locator(".error-banner").or(page.locator('.notice.error')).filter({ hasText: "The new passwords do not match." })).toBeVisible();
  expect(passwordUpdates).toBe(0);
  await page.getByLabel("Confirm new password", { exact: true }).fill("NewPassword!2026");
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await expect(page.getByLabel("Current password", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue("");
  expect(passwordUpdates).toBe(1);
  await sections.getByRole("button", { name: "Preferences", exact: true }).click();
  await page.getByRole("combobox", { name: "Default table rows per page", exact: true }).selectOption("25");
  await page.getByRole("combobox", { name: "Content spacing", exact: true }).selectOption("compact");
  await page.getByRole("checkbox", { name: "Reduce motion", exact: true }).check();
  await page.getByRole("combobox", { name: "Default start page", exact: true }).selectOption("Schools");
  await page.getByRole("button", { name: "Account settings for Taylor Morgan", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Password & security", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await sections.getByRole("button", { name: "Preferences", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-portal-density", "compact");
  await expect(page.locator("html")).toHaveAttribute("data-portal-motion", "reduce");
  if (admin) {
    await sections.getByRole("button", { name: "Platform defaults", exact: true }).click();
    await page.getByLabel("Support information", { exact: true }).fill("Keep this input without asking to save or discard.");
    await navigation.getByRole("button", { name: "Organizations", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Organizations", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Rows per page", exact: true })).toHaveValue("25");
    await navigation.getByRole("button", { name: "Settings", exact: true }).click();
    await sections.getByRole("button", { name: "Platform defaults", exact: true }).click();
    await expect(page.getByLabel("Support information", { exact: true })).toHaveValue("Keep this input without asking to save or discard.");
    expect(settingsUpdates).toBe(0);
    await page.getByLabel("Support information", { exact: true }).fill(settings.values.supportNotes);
    await navigation.getByRole("button", { name: "Organizations", exact: true }).click();
    await navigation.getByRole("button", { name: "Settings", exact: true }).click();
    await sections.getByRole("button", { name: "Platform defaults", exact: true }).click();
    await expect(page.getByLabel("Support information", { exact: true })).toHaveValue(settings.values.supportNotes);
    await page.getByLabel("Support information", { exact: true }).fill("Keep this input without asking to save or discard.");
    await page.getByRole("button", { name: "Save platform settings", exact: true }).click();
    await expect(page.locator('.toast[role="status"]')).toContainText("Platform settings saved");
    expect(settingsUpdates).toBe(1);
  } else await expect(sections.getByRole("button", { name: "Platform defaults", exact: true })).toHaveCount(0);
  for (const section of ["Account & security", "Preferences", ...(admin ? ["Platform defaults"] : []), "Help & support"]) {
    await sections.getByRole("button", { name: section, exact: true }).click();
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/settings-${admin ? "platform" : "organization"}-${section.replace(/[^a-z]+/gi,"-").toLowerCase()}-${width}.png`, fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await expect(page.getByRole("link", { name: /Email support/ })).toHaveAttribute("href", "mailto:support@example.test");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Schools", exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage).includes("NewPassword!2026"))).toBe(false);
  expect(errors).toEqual([]);
  expect(dialogs).toEqual([]);
});
