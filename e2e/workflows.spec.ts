import { test, expect } from "@playwright/test";
test("login hydrates without console mismatches", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydrat|server rendered HTML/i.test(message.text())
    ) {
      hydrationErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => hydrationErrors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill("hydration@example.org");
  await expect(page.locator(".login-wave i")).toHaveCount(42);
  expect(
    await page
      .locator(".login-wave i")
      .evaluateAll((elements) =>
        elements.every((element) =>
          /^-?\d+px$/.test((element as HTMLElement).style.height),
        ),
      ),
  ).toBe(true);
  expect(hydrationErrors).toEqual([]);
});
test("secure workspace, station creation, simulator persistence and PDF", async ({
  page,
  request,
}) => {
  const response = await request.get("/api/analytics");
  expect(response.status()).toBe(401);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Executive overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Listening stations", exact: true })
    .click();
  await page.getByRole("button", { name: "Register station" }).click();
  const name = `QA ${Date.now()}`;
  await page.getByLabel("Station name").fill(name);
  await page.getByLabel("Gallery location").fill("QA test lab");
  await page.getByRole("button", { name: "Save station" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await page.goto("/simulator");
  await page
    .getByLabel("Simulator station")
    .selectOption({ label: `${name} · QA test lab` });
  await page.getByRole("button", { name: "Start listening" }).click();
  await expect(page.getByText("Listening in progress.")).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Stop session" }).click();
  await expect(
    page.getByText("playback stopped", { exact: true }),
  ).toBeVisible();
  await page.goto("/sessions");
  await page.getByLabel("Filter station").selectOption({ label: name });
  await expect(page.locator("tbody")).toContainText(name);
  await expect(page.locator("tbody")).toContainText("ended");
  await page.goto("/reports");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Generate period report", exact: true })
    .click();
  const pdf = await download;
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  await expect(
    page.getByText("Listening performance", { exact: true }).first(),
  ).toBeVisible();
});

test("analysis views, source separation, theme and mobile navigation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.ADMIN_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Executive overview", exact: true }),
  ).toBeVisible();
  for (const [path, title] of [
    ["live", "Live activity"],
    ["engagement", "Engagement analytics"],
    ["quality", "Data quality & verification"],
    ["methodology", "Measurement methodology"],
    ["settings", "Workspace settings"],
  ]) {
    await page.goto("/" + path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  await page.goto("/overview");
  await page.getByLabel("Data source").selectOption("measured");
  await expect(page.getByText("You’re viewing measured data.")).toBeVisible();
  const csv = await page.request.get(
    "/api/reports?format=csv&source=simulated",
  );
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  expect(await csv.text()).toContain("Listening seconds");
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("link", { name: "Listening stations", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Listening stations", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
