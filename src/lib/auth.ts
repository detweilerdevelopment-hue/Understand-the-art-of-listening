import { getServerSession, type NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { db } from "./db";
import { z } from "zod";
import { backendEnabled } from "./backend";
export async function rateLimit(key: string, limit = 60) {
  const now = new Date();
  const window = Math.floor(now.getTime() / 60000);
  const bucket = await db.rateBucket.upsert({
    where: { key: `${key}:${window}` },
    create: {
      key: `${key}:${window}`,
      expiresAt: new Date(now.getTime() + 120000),
    },
    update: { count: { increment: 1 } },
  });
  if (bucket.count > limit) throw new Error("RATE_LIMIT");
}
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 8 * 3600 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "GalleryPulse",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = z
          .object({ email: z.email(), password: z.string().min(1).max(200) })
          .safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        await rateLimit(`login:${email.toLowerCase()}`, 10);
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user || !(await compare(password, user.passwordHash))) return null;
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub ?? "";
      return session;
    },
  },
};
export type Actor = {
  id: string;
  organizationId: string;
  role: string;
  name: string;
  demo: boolean;
};
export async function actor(): Promise<Actor> {
  if (!backendEnabled()) throw new Error("UNAUTHORIZED");
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });
  if (!user) throw new Error("UNAUTHORIZED");
  return {
    id: user.id,
    organizationId: user.organizationId,
    role: user.role,
    name: user.name,
    demo: user.organization.demo,
  };
}
export function canWrite(a: Actor) {
  if (!["ADMIN", "ANALYST"].includes(a.role)) throw new Error("FORBIDDEN");
}
export function adminOnly(a: Actor) {
  if (a.role !== "ADMIN") throw new Error("FORBIDDEN");
}
