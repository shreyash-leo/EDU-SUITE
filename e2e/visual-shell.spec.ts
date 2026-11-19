import { test, expect } from "@playwright/test";

// The isolated runner provisions the account in a temporary database schema.
test("workspace shell remains usable at desktop and narrow widths", async ({ page }) => {
  test.skip(!process.env.E2E_ADMIN_EMAIL || !process.env.E2E_ADMIN_PASSWORD, "Requires isolated administrator credentials");
  await page.goto("/");
  await page.getByRole("button", { name: "Super Admin", exact: true }).click();
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 800 }, { width: 1024, height: 768 }, { width: 901, height: 768 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/dashboard-${viewport.width}.png` });
  }
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).not.toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { document.documentElement.style.zoom = "200%"; });
  const enlargedNavigation = page.getByRole("navigation", { name: "Main navigation" });
  const lastDestination = enlargedNavigation.getByRole("button", { name: "Requests & Settings", exact: true });
  await lastDestination.focus();
  const lastRect = await lastDestination.boundingBox();
  const navRect = await enlargedNavigation.boundingBox();
  expect(lastRect && navRect && lastRect.x + lastRect.width <= navRect.x + navRect.width + 1).toBe(true);
  await page.evaluate(() => { document.documentElement.style.zoom = ""; });
  for (const section of ["Organizations", "Schools", "Onboarding", "Subscriptions", "Requests & Settings"]) {
    await page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: section, exact: true }).click();
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: section, exact: true })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.UI_CAPTURE_PHASE) await page.screenshot({ path: `artifacts/ui-redesign/${process.env.UI_CAPTURE_PHASE}/${section.toLowerCase().replace(/[^a-z]+/g, "-")}.png` });
  }
});
