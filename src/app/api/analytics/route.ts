import { NextResponse } from "next/server";
import { actor } from "@/lib/auth";
import { analytics } from "@/lib/analytics";
import { failure, period } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const a = await actor(),
      p = new URL(req.url).searchParams;
    const { start, end } = period(p);
    return NextResponse.json(
      await analytics(
        a,
        start,
        end,
        p.get("source") === "measured" ? "measured" : "simulated",
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
