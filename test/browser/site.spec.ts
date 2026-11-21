import { expect, test } from "@playwright/test";

const lessonSlugs = [
  "authentication-vs-authorization",
  "oauth-actors-and-trust-boundaries",
  "authorization-code-pkce",
  "access-id-and-refresh-tokens",
  "jwt-paseto-and-opaque-tokens",
];

test("follows the system theme and preserves manual choices across pages", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const root = page.locator("html");
  await expect(root).toHaveCSS("background-color", "rgb(11, 18, 34)");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(root).toHaveCSS("background-color", "rgb(255, 255, 255)");

  const darkToggle = page.getByRole("button", { name: "Switch to dark mode" });
  await darkToggle.press("Enter");
  await expect(root).toHaveCSS("background-color", "rgb(11, 18, 34)");

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Learn" })
    .click();
  await expect(root).toHaveCSS("background-color", "rgb(11, 18, 34)");

  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.reload();
  await expect(root).toHaveCSS("background-color", "rgb(255, 255, 255)");
});

test("serves all lesson directory indexes with production canonicals and a sitemap", async ({
  page,
  request,
}) => {
  await page.goto("/learn/");
  for (const slug of lessonSlugs) {
    const route = `/learn/${slug}/`;
    await expect(page.locator(`main a[href="${route}"]`)).toBeVisible();
    const response = await request.get(route);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(
      `rel="canonical" href="https://oauth.how${route}"`,
    );
  }
  const sitemapIndex = await (await request.get("/sitemap-index.xml")).text();
  expect(sitemapIndex).toContain("https://oauth.how/sitemap-0.xml");
  const sitemap = await (await request.get("/sitemap-0.xml")).text();
  for (const slug of lessonSlugs)
    expect(sitemap).toContain(`https://oauth.how/learn/${slug}/`);
  expect(sitemap).not.toContain("/404");
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Sitemap: https://oauth.how/sitemap-index.xml",
  );
  expect((await request.get("/learn/missing-lesson/")).status()).toBe(404);
});

test("reads and inspects the complete PKCE transcript without JavaScript", async ({
  browser,
}) => {
  const page = await browser.newPage({ javaScriptEnabled: false });
  try {
    await page.goto("/learn/authorization-code-pkce/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Authorization Code + PKCE",
    );
    await page.getByText("Read the complete transcript").click();
    const transcript = page.locator(".static-sequence");
    await expect(
      transcript.getByText("Exchange the code and verifier"),
    ).toBeVisible();
    await expect(
      transcript.getByText("HTTP/1.1 200 OK", { exact: false }).first(),
    ).toBeVisible();
    await expect(
      transcript.getByText("Open the saved-books page"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Play", exact: true }),
    ).toBeDisabled();
  } finally {
    await page.close();
  }
});

test("keeps the homepage and dark-mode playground inside a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "OAuth explained.",
  );
  await expect(
    page.getByRole("img", { name: "Authorization Code with PKCE preview" }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );

  await page.getByRole("link", { name: "Try the playground" }).click();
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeInViewport();
  const select = page.getByLabel("Jump to step");
  await select.selectOption("7");
  await expect(page.locator(".http-message code")).toContainText(
    "code_verifier=",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
});

test("steps through the compact live flow from the homepage first viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const demo = page.getByRole("region", {
    name: "Interactive Authorization Code with PKCE preview",
  });
  const next = demo.getByRole("button", { name: "Next", exact: true });
  await expect(next).toBeInViewport();
  await expect(
    demo.getByText("HTTP request", { exact: true }),
  ).toBeInViewport();
  await expect(demo.locator(".http-message code")).toContainText(
    "GET /connect/library HTTP/1.1",
  );
  await next.click();
  await expect(demo.getByText("Step 2 of 14")).toBeVisible();
  await expect(demo.getByText("HTTP response", { exact: true })).toBeVisible();
  await expect(demo.locator(".http-message code")).toContainText(
    "Location: https://login.example/authorize",
  );
  await demo.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(demo.getByText("Step 1 of 14")).toBeVisible();
});
