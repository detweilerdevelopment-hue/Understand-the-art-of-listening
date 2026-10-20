import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { backendEnabled } from "@/lib/backend";
const authHandler = NextAuth(authOptions);
const handler = (req: Request, context: unknown) =>
  backendEnabled()
    ? authHandler(req, context)
    : new Response(
        JSON.stringify({
          error: "Administrator access requires a configured database.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
export { handler as GET, handler as POST };
