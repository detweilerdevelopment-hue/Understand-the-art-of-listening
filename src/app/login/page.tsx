import Login from "@/components/login-form";
import { backendEnabled } from "@/lib/backend";
import Link from "next/link";
export default function LoginPage() {
  if (!backendEnabled())
    return (
      <main className="loading-page">
        <h1>GalleryPulse demo</h1>
        <p>
          This preview uses packaged synthetic data. No database or login is
          needed.
        </p>
        <Link href="/demo/overview" className="btn btn-primary">
          Explore demo without signing in
        </Link>
      </main>
    );
  return (
    <Login publicDemoEnabled={process.env.PUBLIC_DEMO_ENABLED !== "false"} />
  );
}
