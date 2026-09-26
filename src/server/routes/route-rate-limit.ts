import rateLimit from "express-rate-limit";

// Defence-in-depth limiter for routes registered from modules. The global
// `/api` limiter in server.ts still applies; this one is deliberately
// generous so it never tightens behaviour for real traffic (payment-provider
// webhook retries, LTI launches from a shared campus NAT).
export const routeRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests. Try again shortly.", code: "RATE_LIMITED" },
});
