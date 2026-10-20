export function backendEnabled() {
  return (
    Boolean(process.env.DATABASE_URL?.trim()) &&
    process.env.DEMO_ONLY !== "true"
  );
}
