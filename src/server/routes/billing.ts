// Billing routes extracted verbatim from server.ts (no behaviour change).
// Webhooks are mounted before the JSON body parser and App Check gate (they
// need the raw body and are called by payment providers); the authenticated
// billing API is mounted at its original position near the end of the stack.
import express, { type Express } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { firestoreStore } from "../db";
import { platformStore } from "../platform-store";
import {
  billingPlan,
  billingStatus,
  getBillingProvider,
  paymentCoversPlan,
  verifyLemonSqueezyWebhook,
  verifyMyFatoorahWebhook,
  verifyTapWebhook,
} from "../billing";
import { isPaidProjectPlan } from "../project-access";
import type { AuthenticatedRequest, RouteDeps } from "./types";

export function registerBillingWebhookRoutes(app: Express, deps: RouteDeps) {
  const { apiRateLimit, cleanField, persistVerifiedPayment } = deps;
  app.post(
    "/api/billing/webhook/stripe",
    apiRateLimit,
    express.raw({ type: "application/json", limit: "2mb" }),
    async (req, res) => {
      let webhookClaimId: string | undefined;
      try {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret)
          return res.status(503).json({
            error: "Stripe webhook is not configured",
            code: "STRIPE_WEBHOOK_NOT_CONFIGURED",
          });
        const signature = String(req.header("stripe-signature") || "");
        const fields = signature
          .split(",")
          .map((part) => part.trim().split("=", 2));
        const timestamp = Number(fields.find(([key]) => key === "t")?.[1] || 0),
          provided = fields
            .filter(([key]) => key === "v1")
            .map(([, value]) => String(value || ""));
        if (
          !timestamp ||
          !provided.length ||
          Math.abs(Date.now() / 1000 - timestamp) > 300
        )
          return res.status(401).json({
            error: "Invalid Stripe signature timestamp",
            code: "STRIPE_SIGNATURE_INVALID",
          });
        const raw = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || "");
        const expected = createHmac("sha256", secret)
          .update(`${timestamp}.${raw.toString("utf8")}`)
          .digest("hex");
        const signatureValid = provided.some((value) => {
          const a = Buffer.from(expected),
            b = Buffer.from(value);
          return a.length === b.length && timingSafeEqual(a, b);
        });
        if (!signatureValid)
          return res.status(401).json({
            error: "Invalid Stripe signature",
            code: "STRIPE_SIGNATURE_INVALID",
          });
        const event = JSON.parse(raw.toString("utf8"));
        const eventId = cleanField(event?.id, 240);
        if (!eventId)
          return res.status(400).json({
            error: "Stripe event id is required",
            code: "STRIPE_EVENT_ID_REQUIRED",
          });
        const object = event?.data?.object || {};
        const type = String(event.type || "unknown");
        let stripeMetadata =
          object?.metadata || object?.subscription_details?.metadata || {};
        const paymentIntentId = String(
          typeof object?.payment_intent === "string"
            ? object.payment_intent
            : object?.payment_intent?.id || "",
        );
        if (
          !stripeMetadata?.tenantId &&
          /^pi_[A-Za-z0-9_]+$/.test(paymentIntentId) &&
          process.env.STRIPE_SECRET_KEY
        ) {
          const lookup = await fetch(
            `https://api.stripe.com/v1/payment_intents/${paymentIntentId}`,
            {
              headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
              signal: AbortSignal.timeout(10_000),
            },
          );
          if (lookup.ok) {
            const paymentIntent: any = await lookup.json();
            stripeMetadata = paymentIntent?.metadata || stripeMetadata;
          }
        }
        const tenantId = String(
          stripeMetadata?.tenantId || "",
        );
        const userId = String(stripeMetadata?.userId || "");
        const projectId = String(stripeMetadata?.projectId || "");
        const planId = String(stripeMetadata?.planId || "");
        if (!tenantId)
          return res.status(202).json({ received: true, ignored: true });
        const claim = await platformStore.claimExternalWebhook(
          "stripe",
          eventId,
        );
        webhookClaimId = claim.id;
        if (!claim.claimed)
          return res.json({ received: true, duplicate: true });
        const at = new Date().toISOString();
        if (type.startsWith("customer.subscription.")) {
          const rawStatus = String(object.status || "incomplete");
          const status =
            rawStatus === "canceled"
              ? "cancelled"
              : [
                    "trialing",
                    "active",
                    "past_due",
                    "unpaid",
                    "paused",
                    "incomplete",
                    "incomplete_expired",
                  ].includes(rawStatus)
                ? rawStatus
                : "expired";
          await platformStore.create(
            "subscriptions",
            tenantId,
            "stripe",
            {
              title: `Stripe subscription ${object.id || event.id}`,
              status,
              data: {
                stripeEventId: event.id,
                provider: "stripe",
                externalId: object.id || null,
                userId: userId || null,
                customerId: object.customer || null,
                currentPeriodEnd: object.current_period_end
                  ? new Date(
                      Number(object.current_period_end) * 1000,
                    ).toISOString()
                  : null,
                cancelAtPeriodEnd: Boolean(object.cancel_at_period_end),
                receivedAt: at,
              },
            },
            `Stripe webhook ${type}`,
          );
          if (["active", "trialing"].includes(status))
            await platformStore.recordEvent({
              tenantId,
              userId: userId || "stripe",
              name: "subscription_started",
              properties: { provider: "stripe" },
              provenance: "server",
            });
        } else {
          let status = "pending";
          // جلسة مكتملة لا تعني دفعًا مستلَمًا: وسائل الدفع المؤجّلة تُكمل الجلسة
          // بـ payment_status=unpaid ثم ترسل async_payment_succeeded لاحقًا.
          const sessionPaid =
            (type === "checkout.session.completed" && object.payment_status === "paid") ||
            type === "checkout.session.async_payment_succeeded";
          if (sessionPaid || type === "invoice.paid")
            status = "paid";
          else if (type.includes("payment_failed")) status = "failed";
          else if (type.includes("refunded")) status = "refunded";
          else if (type.includes("dispute")) status = "chargeback";
          await platformStore.create(
            "transactions",
            tenantId,
            "stripe",
            {
              title: `Stripe ${type}`,
              status,
              data: {
                stripeEventId: event.id,
                provider: "stripe",
                externalId: object.id || null,
                userId: userId || null,
                amount: Number(
                  object.amount_total ||
                    object.amount_paid ||
                    object.amount ||
                    0,
                ),
                currency: String(object.currency || "").toUpperCase(),
                planId: planId || null,
                projectId: projectId || null,
                receivedAt: at,
              },
            },
            `Stripe webhook ${type}`,
          );
          if (sessionPaid) {
            if (!userId || !projectId || !isPaidProjectPlan(planId))
              throw Object.assign(new Error("Paid project metadata is incomplete"), {
                status: 400,
                code: "PAYMENT_METADATA_INVALID",
              });
            // Defense in depth: never unlock a plan the captured amount does not
            // cover, even though the Checkout Session is created server-side.
            // Stripe amounts are in minor units (cents) → convert to major.
            const capturedMajor =
              Number(
                object.amount_total || object.amount_paid || object.amount || 0,
              ) / 100;
            if (
              paymentCoversPlan({
                planId,
                amount: capturedMajor,
                currency: String(object.currency || "USD"),
              }) === false
            )
              throw Object.assign(
                new Error("Captured amount does not cover the requested plan"),
                { status: 400, code: "PAYMENT_AMOUNT_MISMATCH" },
              );
            await platformStore.grantProjectEntitlement({
              tenantId,
              userId,
              projectId,
              planId,
              provider: "stripe",
              externalId: String(object.id || paymentIntentId),
              eventId,
              externalRefs: [paymentIntentId],
            });
            await platformStore.recordEvent({
              tenantId,
              userId: userId || "stripe",
              name: "project_plan_purchased",
              projectId,
              properties: { provider: "stripe", planId },
              provenance: "server",
            });
          } else if (status === "refunded" || status === "chargeback") {
            if (userId && projectId)
              await platformStore.revokeProjectEntitlement({
                tenantId,
                userId,
                projectId,
                provider: "stripe",
                externalId: String(paymentIntentId || object.id),
                eventId,
                reason: status,
              });
          }
        }
        await platformStore.completeExternalWebhook(
          webhookClaimId,
          "completed",
        );
        res.json({ received: true });
      } catch (error) {
        if (webhookClaimId)
          await platformStore
            .completeExternalWebhook(
              webhookClaimId,
              "failed",
              error instanceof Error ? error.message : "Webhook failed",
            )
            .catch(() => undefined);
        console.error("Stripe webhook failed", error);
        res.status(400).json({
          error: "Webhook payload could not be processed",
          code: "STRIPE_WEBHOOK_INVALID",
        });
      }
    },
  );
  app.post(
    "/api/billing/webhook/tap",
    apiRateLimit,
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      try {
        const raw = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || "");
        const event = verifyTapWebhook(
          raw,
          String(req.header("hashstring") || ""),
        );
        const result = await persistVerifiedPayment(event);
        res.json({ received: true, ...result });
      } catch (error: any) {
        res.status(Number(error?.status || 400)).json({
          error: "Tap webhook could not be verified",
          code: error?.code || "TAP_WEBHOOK_INVALID",
        });
      }
    },
  );
  app.post(
    "/api/billing/webhook/myfatoorah",
    apiRateLimit,
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      try {
        const raw = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || "");
        const event = verifyMyFatoorahWebhook(
          raw,
          String(req.header("myfatoorah-signature") || ""),
        );
        const result = await persistVerifiedPayment(event);
        res.json({ received: true, ...result });
      } catch (error: any) {
        res.status(Number(error?.status || 400)).json({
          error: "MyFatoorah webhook could not be verified",
          code: error?.code || "MYFATOORAH_WEBHOOK_INVALID",
        });
      }
    },
  );
  app.post(
    "/api/billing/webhook/lemonsqueezy",
    apiRateLimit,
    express.raw({ type: "application/json", limit: "1mb" }),
    async (req, res) => {
      try {
        const raw = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(req.body || "");
        const event = verifyLemonSqueezyWebhook(
          raw,
          String(req.header("x-signature") || ""),
        );
        const result = await persistVerifiedPayment(event);
        res.json({ received: true, ...result });
      } catch (error: any) {
        res.status(Number(error?.status || 400)).json({
          error: "Lemon Squeezy webhook could not be verified",
          code: error?.code || "LEMONSQUEEZY_WEBHOOK_INVALID",
        });
      }
    },
  );
}

export function registerBillingApiRoutes(app: Express, deps: RouteDeps) {
  const { authenticate, cleanField } = deps;
  app.get("/api/billing/status", authenticate, (_req, res) =>
    res.json({ success: true, billing: billingStatus() }),
  );
  app.get(
    "/api/projects/:id/access",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const project = await firestoreStore.getProject(
          req.params.id,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res
            .status(404)
            .json({ error: "Project not found", code: "PROJECT_NOT_FOUND" });
        const access = await platformStore.projectEntitlementAccess(
          a.tenantId,
          a.userId,
          project.id,
        );
        res.json({ success: true, access });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/billing/checkout",
    authenticate,
    async (req: AuthenticatedRequest, res, next) => {
      try {
        const a = req.actor!;
        const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(
          /\/$/,
          "",
        );
        if (
          process.env.NODE_ENV === "production" &&
          !appUrl.startsWith("https://")
        )
          return res.status(503).json({
            error:
              "Production APP_URL must use HTTPS before billing can be enabled",
            code: "BILLING_APP_URL_INVALID",
          });
        const idempotencyKey =
          cleanField(req.header("x-idempotency-key"), 120) || randomUUID();
        const selectedPlan = billingPlan(cleanField(req.body?.planId, 40));
        if (!selectedPlan || selectedPlan.id === "preview")
          return res.status(400).json({
            error: "اختر باقة مدفوعة صحيحة.",
            code: "BILLING_PLAN_INVALID",
          });
        const projectId = cleanField(req.body?.projectId, 180);
        if (!projectId)
          return res.status(400).json({
            error: "اختر المشروع الذي تريد فتحه قبل الدفع.",
            code: "BILLING_PROJECT_REQUIRED",
          });
        const project = await firestoreStore.getProject(
          projectId,
          a.userId,
          a.tenantId,
        );
        if (!project)
          return res.status(404).json({
            error: "المشروع غير موجود أو لا تملكه.",
            code: "PROJECT_NOT_FOUND",
          });
        if (project.collaborationMode === "group" && selectedPlan.id !== "group")
          return res.status(400).json({
            error: "مشروع المجموعة يحتاج باقة المجموعة.",
            code: "GROUP_PLAN_REQUIRED",
          });
        const provider = getBillingProvider();
        const result = await provider.createCheckout({
          customerEmail: a.email,
          customerName: a.displayName,
          tenantId: a.tenantId,
          userId: a.userId,
          projectId: project.id,
          idempotencyKey,
          planId: selectedPlan.id,
          amountUsd: selectedPlan.amountUsd,
          description: `AcademicOS — ${selectedPlan.name} — ${project.title}`,
          webhookUrl: `${appUrl}/api/billing/webhook/${provider.id}`,
          successUrl: `${appUrl}/app/plans?billing=success&plan=${selectedPlan.id}&project=${encodeURIComponent(project.id)}`,
          cancelUrl: `${appUrl}/app/plans?billing=cancelled&project=${encodeURIComponent(project.id)}`,
        });
        await firestoreStore.writeAudit(
          a.tenantId,
          a.userId,
          "billing.checkout.create",
          a.userId,
          undefined,
          { planId: selectedPlan.id, amountUsd: selectedPlan.amountUsd, projectId: project.id },
        );
        res.json({ success: true, ...result });
      } catch (e) {
        next(e);
      }
    },
  );
}
