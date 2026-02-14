// @ts-check
import { test, expect } from "@playwright/test";

test.describe("Smoke E2E", () => {
  test("главная страница загружается", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Epochal|Dialog|my-app|React/i);
  });

  test("страница содержит корневой контейнер приложения", async ({ page }) => {
    await page.goto("/");
    const root = page.locator("#root");
    await expect(root).toBeVisible({ timeout: 15000 });
  });
});
