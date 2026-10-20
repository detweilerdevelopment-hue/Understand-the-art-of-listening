import { analytics } from "./analytics";
import { db } from "./db";
import type { Actor } from "./auth";
import { reportSnapshot } from "./report-format";
export { reportPdf, csvCell } from "./report-format";
export async function createReport(
  a: Actor,
  start: Date,
  end: Date,
  sourceType: string,
) {
  const data = await analytics(a, start, end, sourceType);
  const snapshot = reportSnapshot(data);
  return db.report.upsert({
    where: {
      organizationId_periodStart_periodEnd_sourceType: {
        organizationId: a.organizationId,
        periodStart: start,
        periodEnd: end,
        sourceType,
      },
    },
    create: {
      organizationId: a.organizationId,
      periodStart: start,
      periodEnd: end,
      sourceType,
      timezone: data.timezone,
      snapshot,
    },
    update: { snapshot, generatedAt: new Date() },
  });
}
