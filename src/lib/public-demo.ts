import type { Actor } from "./auth";
import { period } from "./http";
import { DEMO_END, packagedAnalytics } from "./demo-data";
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
  return {
    id: "public-demo",
    organizationId: "packaged-gallery-demo",
    name: "Demo guest",
    role: "VIEWER",
    demo: true,
  };
}
export async function demoPeriod(params: URLSearchParams, a: Actor) {
  if (a.organizationId !== "packaged-gallery-demo")
    throw new Error("FORBIDDEN");
  if (params.has("start") || params.has("end")) return period(params);
  const end = new Date(DEMO_END);
  return { start: new Date(+end - 28 * 86400000), end };
}
export async function demoAnalytics(a: Actor, start: Date, end: Date) {
  if (a.organizationId !== "packaged-gallery-demo")
    throw new Error("FORBIDDEN");
  return packagedAnalytics(start, end);
}
