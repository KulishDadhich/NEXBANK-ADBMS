import { test, expect } from "@playwright/test";
test("register, create account, persist refresh session, and protect admin navigation", async ({
  page,
}) => {
  if (!process.env.DATABASE_URL?.includes("_test"))
    throw Error("E2E requires isolated test database");
  await page.goto("/register");
  await page.getByLabel("Full name").fill("Browser Student");
  await page
    .getByLabel("Email address")
    .fill(`browser-${Date.now()}@test.invalid`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Browser-test-password-123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: "Good to see you, Browser." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "My accounts" }).click();
  await page.getByRole("button", { name: "Open account" }).click();
  await expect(page.locator(".account-grid .bank-card")).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Your accounts." }),
  ).toBeVisible();
  await expect(page.locator(".account-grid .bank-card")).toHaveCount(1);
  await page.goto("/app/admin");
  await expect(
    page.getByRole("heading", { name: "Good to see you, Browser." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
});
test("admin overview and isolated lab navigation", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("link", { name: "Administration", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The bigger picture." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Database laboratory" }).click();
  await expect(
    page.getByRole("heading", { name: "See the database at work." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Rollback after a partial debit" }),
  ).toBeVisible();
});
