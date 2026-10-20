import { redirect, notFound } from "next/navigation";
import { actor } from "@/lib/auth";
import { analytics } from "@/lib/analytics";
import { Dashboard } from "@/components/dashboard";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    ![
      "overview",
      "stations",
      "live",
      "sessions",
      "engagement",
      "reports",
      "quality",
      "methodology",
      "simulator",
      "settings",
    ].includes(section)
  )
    notFound();
  let a;
  try {
    a = await actor();
  } catch {
    redirect("/login");
  }
  const end = new Date(),
    start = new Date(+end - 28 * 86400000);
  const data = await analytics(
    a,
    start,
    end,
    a.demo ? "simulated" : "measured",
  );
  return (
    <Dashboard
      section={section}
      initial={JSON.parse(JSON.stringify(data))}
      user={{ name: a.name, role: a.role, demo: a.demo }}
    />
  );
}
