import { expect, test } from "@playwright/test";

test("walks the code exchange with keyboard controls, selection, and HTTP inspection", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4321/"))
      external.push(request.url());
  });
  await page.goto("/playground/");
  const next = page.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeEnabled();
  await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();
  await next.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Step 2 of 14")).toBeVisible();
  await expect(page.locator(".http-message code")).toContainText(
    "Location: https://login.example/authorize",
  );
  await expect(page.locator(".sequence-actor.is-active")).toHaveCount(2);

  const select = page.getByLabel("Jump to step");
  await select.selectOption({ label: "8. Exchange the code and verifier" });
  await expect(page.locator(".http-message code")).toContainText(
    "POST /token HTTP/1.1",
  );
  await expect(page.locator(".http-message code")).toContainText(
    "code_verifier=",
  );
  await next.click();
  await expect(page.locator(".http-message code")).toContainText(
    "Cache-Control: no-store",
  );
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(select).toHaveValue("7");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(select).toHaveValue("0");
  expect(external).toEqual([]);
});

test("honors speed, pause, and reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await page.goto("/playground/#pkce");
  const select = page.getByLabel("Jump to step");
  await expect(select).toBeEnabled();
  const speed = page.getByRole("combobox", { name: "Speed", exact: true });
  await expect(speed).toHaveValue("1");
  await speed.selectOption("2");
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.clock.runFor(1050);
  await expect(select).toHaveValue("1");
  const animations = await page
    .locator(".sequence-packet")
    .evaluate((element) => element.getAnimations().length);
  expect(animations).toBe(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.clock.runFor(2200);
  await expect(select).toHaveValue("1");
});
