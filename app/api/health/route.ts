// Liveness for uptime checks and the backend's keep-awake pings: cheap, no auth, never cached.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
