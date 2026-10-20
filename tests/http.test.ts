import { describe, it, expect, vi } from "vitest";
import { period, sameOrigin, failure, boundedJson } from "../src/lib/http";
import { csvCell } from "../src/lib/reports";
import { canWrite, adminOnly } from "../src/lib/auth";
import { GET as cron } from "../src/app/api/cron/route";
import { POST as events } from "../src/app/api/events/route";
describe("request and export boundaries", () => {
  it("disables device ingestion and scheduled writes in demo-only mode", async () => {
    vi.stubEnv("DEMO_ONLY", "true");
    vi.stubEnv("CRON_SECRET", "test-disabled-backend");
    try {
      expect((await events(new Request("http://localhost/api/events", {
        method: "POST", headers: { authorization: "Bearer any-token" }, body: "{}",
      }))).status).toBe(503);
      expect((await cron(new Request("http://localhost/api/cron", {
        headers: { authorization: "Bearer test-disabled-backend" },
      }))).status).toBe(503);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("enforces viewer, analyst and administrator permissions", () => {
    const actor = {
      id: "viewer",
      organizationId: "test",
      role: "VIEWER",
      name: "Viewer",
      demo: false,
    };
    expect(() => canWrite(actor)).toThrow("FORBIDDEN");
    expect(() => adminOnly({ ...actor, role: "ANALYST" })).toThrow("FORBIDDEN");
    expect(() => canWrite({ ...actor, role: "ANALYST" })).not.toThrow();
    expect(() => adminOnly({ ...actor, role: "ADMIN" })).not.toThrow();
  });
  it("rejects non-ASCII cron credentials without a timing comparison exception", async () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test";
    try {
      expect(
        (
          await cron(
            new Request("http://localhost:3000/api/cron", {
              headers: { Authorization: "Bearer tést" },
            }),
          )
        ).status,
      ).toBe(401);
    } finally {
      if (previous === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = previous;
    }
  });
  it("rejects invalid or unbounded reporting periods", () => {
    try {
      period(new URLSearchParams({ end: "bad" }));
      throw new Error("Expected date validation failure");
    } catch (error) {
      expect(failure(error).status).toBe(400);
    }
    expect(() =>
      period(new URLSearchParams({ start: "bad", end: "bad" })),
    ).toThrow();
    expect(() =>
      period(new URLSearchParams({ start: "2026-01-01", end: "2026-10-01" })),
    ).toThrow();
  });
  it("bounds actual UTF-8 bytes without trusting content-length", async () => {
    const request = (body: string, length?: string) => new Request("http://localhost/api/events", {
      method: "POST", body,
      headers: length ? { "content-length": length } : {},
    });
    expect(await boundedJson(request('{"ok":true}'), 16)).toEqual({ ok: true });
    await expect(boundedJson(request(JSON.stringify("x".repeat(40))), 16))
      .rejects.toThrow("PAYLOAD_TOO_LARGE");
    await expect(boundedJson(request(JSON.stringify("é".repeat(10)), "1"), 16))
      .rejects.toThrow("PAYLOAD_TOO_LARGE");
    expect(failure(new Error("PAYLOAD_TOO_LARGE")).status).toBe(413);
  });
  it("rejects cross-origin browser writes", () => {
    expect(() =>
      sameOrigin(
        new Request("http://localhost:3000/api/stations", {
          headers: { origin: "https://attacker.example" },
        }),
      ),
    ).toThrow("FORBIDDEN");
  });
  it("maps authorization failures without exposing internal errors", async () => {
    expect(failure(new Error("UNAUTHORIZED")).status).toBe(401);
    expect(failure(new Error("FORBIDDEN")).status).toBe(403);
  });
  it("escapes spreadsheet formulas and quoted values", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("a,b")).toBe('"a,b"');
  });
});
