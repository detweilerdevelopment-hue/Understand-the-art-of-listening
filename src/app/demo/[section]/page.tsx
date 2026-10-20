import { notFound } from "next/navigation";
import {
  demoActor,
  demoAnalytics,
  demoPeriod,
  demoSections,
} from "@/lib/public-demo";
import { Dashboard } from "@/components/dashboard";
export const dynamic = "force-dynamic";
export default async function DemoPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!demoSections.some((s) => s === section)) notFound();
  const a = await demoActor().catch((error) => {
    if (error instanceof Error && error.message === "NOT_FOUND") notFound();
    throw error;
  });
  const { start, end } = await demoPeriod(new URLSearchParams(), a);
  const data = await demoAnalytics(a, start, end);
  return (
    <Dashboard
      section={section}
      initial={JSON.parse(JSON.stringify(data))}
      user={{ name: a.name, role: a.role, demo: true, publicDemo: true }}
    />
  );
}
