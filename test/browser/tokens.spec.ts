import { expect, test } from "@playwright/test";

test("decodes tokens and reports independent signature and claim outcomes", async ({
  page,
}) => {
  await page.goto("/playground/#tokens");
  const sample = page.getByRole("combobox", { name: "Sample", exact: true });
  const verify = page.getByRole("button", { name: "Verify token" });
  const result = page.getByRole("status");

  await expect(result).toContainText("Decoded values are untrusted");
  await verify.click();
  await expect(result).toContainText("Accepted.");

  await sample.selectOption("tampered");
  await expect(page.locator(".token-fields")).toContainText("books:write");
  await expect(result).toContainText("Decoded values are untrusted");
  await verify.click();
  await expect(result).toContainText("The signature does not match");

  await sample.selectOption("wrong-audience");
  await verify.click();
  await expect(result).toContainText(
    "The signature is valid. The audience does not include the library API.",
  );

  await sample.selectOption("expired");
  await verify.click();
  await expect(result).toContainText(
    "The signature is valid. The token has expired",
  );
});
