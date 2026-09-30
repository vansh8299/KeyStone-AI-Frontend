const isDev = process.env.NODE_ENV !== "production";

// The API the browser talks to: GraphQL over HTTP, subscriptions over WebSocket, and attachment
// images. Everything else the app loads comes from its own origin.
const apiUrl = new URL(process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:4000/graphql");
const wsUrl = new URL(process.env.NEXT_PUBLIC_GRAPHQL_WS_URL || apiUrl.href.replace(/^http/, "ws"));

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next.js inlines its bootstrap and the theme script; development also needs eval for fast refresh.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiUrl.origin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl.origin} ${wsUrl.origin}${isDev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig = {
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
