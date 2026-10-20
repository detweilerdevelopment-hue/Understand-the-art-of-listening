import { db } from "./db";
import { analytics } from "./analytics";
import type { Actor } from "./auth";
import { period } from "./http";
export const demoSections = [
  "overview",
  "stations",
  "live",
  "sessions",
  "engagement",
  "reports",
  "quality",
  "methodology",
] as const;
export async function demoActor(): Promise<Actor> {
  if (process.env.PUBLIC_DEMO_ENABLED === "false") throw new Error("NOT_FOUND");
  const org = await db.organization.findFirst({
    where: { id: "gallery-demo", demo: true },
  });
  if (!org) throw new Error("NOT_FOUND");
  return {
    id: "public-demo",
    organizationId: org.id,
    name: "Demo guest",
    role: "VIEWER",
    demo: true,
  };
}
export async function demoPeriod(params: URLSearchParams, a: Actor) {
  if (params.has("start") || params.has("end")) return period(params);
  const latest = await db.rawEvent.findFirst({
    where: {
      sourceType: "simulated",
      station: { gallery: { organizationId: a.organizationId } },
    },
    orderBy: { timestamp: "desc" },
    select: { timestamp: true },
  });
  const end = latest ? new Date(+latest.timestamp + 1) : new Date();
  return { start: new Date(+end - 28 * 86400000), end };
}
export async function demoAnalytics(a: Actor, start: Date, end: Date) {
  const data = await analytics(a, start, end, "simulated");
  return {
    ...data,
    stations: data.stations.map((s) => ({
      ...s,
      devices: s.devices.filter((d) => d.simulated),
    })),
  };
}
