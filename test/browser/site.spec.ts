import { expect, test } from "@playwright/test";

const lessonSlugs = [
  "authentication-vs-authorization",
  "oauth-actors-and-trust-boundaries",
  "authorization-code-pkce",
  "access-id-and-refresh-tokens",
  "jwt-paseto-and-opaque-tokens",
];

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
  const select = page.getByLabel("Jump to step");
  await select.selectOption("7");
  await expect(page.locator(".http-message code")).toContainText(
    "code_verifier=",
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    360,
  );
});
