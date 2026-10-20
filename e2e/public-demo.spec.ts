import { test, expect } from "@playwright/test";
test("client can explore the demo and reports without credentials", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page).toHaveURL(/\/demo\/overview$/);
  await expect(
    page.getByRole("heading", { name: "Executive overview", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("READ-ONLY PUBLIC DEMO")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Workspace settings", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Generate report", exact: true }),
  ).toHaveCount(0);
  await expect(
    page
      .getByLabel("Data source")
      .getByRole("option", { name: "Measured data" }),
  ).toHaveCount(0);
  for (const section of [
    "stations",
    "live",
    "sessions",
    "engagement",
    "quality",
    "methodology",
    "reports",
  ]) {
    await page.goto("/demo/" + section);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".alert.error")).toHaveCount(0);
    if (section === "sessions") {
      await page
        .getByRole("button", { name: /Inspect session/ })
        .first()
        .click();
      await expect(
        page.getByRole("dialog", { name: "Session evidence" }),
      ).toBeVisible();
      expect(
        await page
          .getByRole("dialog")
          .getByText("Raw event", { exact: true })
          .count(),
      ).toBeGreaterThan(0);
      await page.getByRole("button", { name: "Close dialog" }).click();
    }
  }
  const download = page.waitForEvent("download");
  await page
    .getByRole("link", { name: "Download", exact: true })
    .first()
    .click();
  expect((await download).suggestedFilename()).toMatch(/\.pdf$/);
  const data = await (await request.get("/api/demo/analytics")).json();
  expect(data.sourceType).toBe("simulated");
  expect(
    data.events.every(
      (e: { sourceType: string }) => e.sourceType === "simulated",
    ),
  ).toBe(true);
  expect(
    data.stations.every((s: { devices: { simulated: boolean }[] }) =>
      s.devices.every((d) => d.simulated),
    ),
  ).toBe(true);
  expect(
    data.reports.every(
      (r: { sourceType: string }) => r.sourceType === "simulated",
    ),
  ).toBe(true);
  expect(
    (await request.get("/api/demo/analytics?source=measured")).status(),
  ).toBe(403);
  expect((await request.get("/api/analytics")).status()).toBe(401);
  expect(
    (
      await request.post("/api/stations", { data: { name: "Unauthorized" } })
    ).status(),
  ).toBe(401);
  expect((await request.post("/api/simulator", { data: {} })).status()).toBe(
    401,
  );
  expect(
    (await request.post("/api/demo/analytics", { data: {} })).status(),
  ).toBe(405);
  expect((await request.get("/api/demo/settings")).status()).toBe(404);
  await page.goto("/demo/settings");
  await expect(
    page.getByRole("heading", { name: "404", exact: true }),
  ).toBeVisible();
  expect(
    (await request.get("/api/demo/sessions?id=not-a-demo-session")).status(),
  ).toBe(404);
  expect(
    (await request.get("/api/demo/reports?id=not-a-demo-report")).status(),
  ).toBe(404);
  const csv = await request.get("/api/demo/reports?format=csv");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  await page.goto("/login");
  await page
    .getByRole("link", { name: "Explore demo without signing in" })
    .click();
  await expect(page).toHaveURL(/\/demo\/overview$/);
  expect(errors).toEqual([]);
});
