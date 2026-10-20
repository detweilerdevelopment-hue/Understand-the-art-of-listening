import Login from "@/components/login-form";
export default function LoginPage() {
  return (
    <Login publicDemoEnabled={process.env.PUBLIC_DEMO_ENABLED !== "false"} />
  );
}
