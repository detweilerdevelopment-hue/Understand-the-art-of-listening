import { afterEach, describe, it, expect, vi } from "vitest";
vi.mock("../src/lib/db", () => {
  throw new Error("Public demo must not import a database client");
});
import { demoData, packagedAnalytics } from "../src/lib/demo-data";
import { demoActor, demoPeriod } from "../src/lib/public-demo";
import { GET } from "../src/app/api/demo/[resource]/route";
afterEach(() => vi.unstubAllEnvs());
const get = (resource: string, query = "") =>
  GET(new Request(`http://localhost/api/demo/${resource}${query}`), {
    params: Promise.resolve({ resource }),
  });
describe("packaged demo without a database", () => {
  it("loads complete synthetic analytics with no credentials or database imports", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DIRECT_URL", "");
    vi.stubEnv("NEXTAUTH_SECRET", "");
    const a = await demoActor(),
      { start, end } = await demoPeriod(new URLSearchParams(), a);
    const data = packagedAnalytics(start, end);
    expect(data.metrics.sessions).toBeGreaterThan(1000);
    expect(data.stations).toHaveLength(4);
    expect(data.reports).toHaveLength(4);
    expect(demoData.events.every((e) => e.sourceType === "simulated")).toBe(
      true,
    );
    expect((await get("analytics")).status).toBe(200);
  });
  it("applies periods and station pagination rather than returning static counters", async () => {
    const first = await (await get("sessions", "?page=1")).json(),
      second = await (await get("sessions", "?page=2")).json();
    expect(first.rows).toHaveLength(20);
    expect(second.rows).toHaveLength(20);
    expect(first.rows[0].id).not.toBe(second.rows[0].id);
    const station = demoData.stations[0].id;
    const filtered = await (
      await get("sessions", `?station=${station}`)
    ).json();
    expect(
      filtered.rows.every(
        (s: { stationId: string }) => s.stationId === station,
      ),
    ).toBe(true);
    const empty = packagedAnalytics(
      new Date("2000-01-01"),
      new Date("2000-01-02"),
    );
    expect(empty.metrics.sessions).toBe(0);
    expect(empty.metrics.engagedRate).toBeNull();
  });
  it("traces sessions to packaged evidence and keeps all writes private", async () => {
    const session = demoData.sessions[0];
    const response = await (await get("sessions", `?id=${session.id}`)).json();
    expect(response.events.map((e: { id: string }) => e.id)).toEqual(
      session.eventIds,
    );
    expect((await get("sessions", "?id=private-session")).status).toBe(404);
    expect((await get("analytics", "?source=measured")).status).toBe(403);
  });
  it("generates real PDF and CSV downloads from shared calculations", async () => {
    const report = demoData.reports[0],
      data = packagedAnalytics(report.periodStart, report.periodEnd);
    expect((report.snapshot as { metrics: unknown }).metrics).toEqual(
      data.metrics,
    );
    const pdf = await get("reports", `?id=${report.id}`);
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");
    const csv = await get("reports", "?format=csv");
    expect(await csv.text()).toContain("Listening seconds");
  });
  it("supports disabling public access without a database", async () => {
    vi.stubEnv("PUBLIC_DEMO_ENABLED", "false");
    expect((await get("analytics")).status).toBe(404);
  });
});
