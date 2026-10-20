import { describe, it, expect } from "vitest";
import { period, sameOrigin, failure } from "../src/lib/http";
import { csvCell } from "../src/lib/reports";
import { canWrite, adminOnly } from "../src/lib/auth";
import { GET as cron } from "../src/app/api/cron/route";
describe("request and export boundaries", () => {
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
    expect(() =>
      period(new URLSearchParams({ start: "bad", end: "bad" })),
    ).toThrow();
    expect(() =>
      period(new URLSearchParams({ start: "2026-01-01", end: "2026-10-01" })),
    ).toThrow();
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
