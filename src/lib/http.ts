import { NextResponse } from "next/server";
import { ZodError } from "zod";
export function failure(e: unknown) {
  const message =
    e instanceof SyntaxError
      ? "Invalid JSON body"
      : e instanceof Error
        ? e.message
        : "Unexpected error";
  const status =
    message === "UNAUTHORIZED"
      ? 401
      : message === "FORBIDDEN"
        ? 403
        : message === "NOT_FOUND"
          ? 404
          : message === "RATE_LIMIT"
            ? 429
            : e instanceof ZodError ||
                e instanceof SyntaxError ||
                ["FUTURE_TIMESTAMP", "EVENT_ID_CONFLICT"].includes(message)
              ? 400
              : 500;
  if (status === 500)
    console.error(
      JSON.stringify({
        level: "error",
        message,
        timestamp: new Date().toISOString(),
      }),
    );
  return NextResponse.json(
    {
      error:
        status === 500
          ? "The request could not be completed. Check server logs."
          : message,
    },
    { status },
  );
}
export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (
    origin &&
    origin !== new URL(req.url).origin &&
    origin !== process.env.NEXTAUTH_URL
  )
    throw new Error("FORBIDDEN");
}
export function period(params: URLSearchParams) {
  const end = new Date(params.get("end") ?? new Date().toISOString());
  const start = new Date(
    params.get("start") ??
      new Date(end.getTime() - 28 * 86400000).toISOString(),
  );
  if (
    !Number.isFinite(+start) ||
    !Number.isFinite(+end) ||
    end <= start ||
    +end - +start > 93 * 86400000
  )
    throw new ZodError([
      {
        code: "custom",
        path: ["period"],
        message: "Use a valid date range of at most 93 days",
      },
    ]);
  return { start, end };
}
