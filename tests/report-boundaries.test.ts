import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  actor: vi.fn(), sessions: vi.fn(), audit: vi.fn(), report: vi.fn(),
}));
vi.mock("../src/lib/auth", () => ({ actor: mocks.actor, canWrite: vi.fn() }));
vi.mock("../src/lib/db", () => ({ db: {
  listeningSession: { findMany: mocks.sessions },
  auditLog: { create: mocks.audit },
  report: { findFirst: mocks.report },
} }));
vi.mock("../src/lib/reports", () => ({
  createReport: vi.fn(), reportPdf: vi.fn(), csvCell: vi.fn(),
}));
import { GET } from "../src/app/api/reports/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.actor.mockResolvedValue({ id: "user", organizationId: "allowed-org", role: "VIEWER" });
});

it("refuses a partial CSV instead of presenting 50,000 rows as a full export", async () => {
  mocks.sessions.mockResolvedValue(Array(50001).fill({}));
  const response = await GET(new Request("http://localhost/api/reports?format=csv"));
  expect(response.status).toBe(413);
  expect((await response.json()).error).toContain("shorter date range");
  expect(mocks.audit).not.toHaveBeenCalled();
});

it("scopes exact report IDs to the authenticated organization", async () => {
  mocks.report.mockResolvedValue(null);
  const response = await GET(new Request("http://localhost/api/reports?id=another-tenants-report"));
  expect(response.status).toBe(404);
  expect(mocks.report).toHaveBeenCalledWith({ where: {
    id: "another-tenants-report", organizationId: "allowed-org",
  } });
  expect(mocks.audit).not.toHaveBeenCalled();
});
