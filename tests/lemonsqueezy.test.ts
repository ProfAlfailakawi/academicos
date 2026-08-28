import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { getBillingProvider, verifyLemonSqueezyWebhook, billingStatus } from '../src/server/billing';

const ENV_KEYS = [
  'BILLING_PROVIDER',
  'LEMONSQUEEZY_API_KEY',
  'LEMONSQUEEZY_STORE_ID',
  'LEMONSQUEEZY_VARIANT_ID',
  'LEMONSQUEEZY_WEBHOOK_SECRET',
  'LEMONSQUEEZY_KWD_USD_RATE',
] as const;

function withLemonEnv(run: () => Promise<void> | void) {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  process.env.BILLING_PROVIDER = 'lemonsqueezy';
  process.env.LEMONSQUEEZY_API_KEY = 'test-api-key';
  process.env.LEMONSQUEEZY_STORE_ID = '55555';
  process.env.LEMONSQUEEZY_VARIANT_ID = '99999';
  process.env.LEMONSQUEEZY_WEBHOOK_SECRET = 'test-webhook-secret';
  process.env.LEMONSQUEEZY_KWD_USD_RATE = '3.26';
  const restore = () => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k]!;
    }
  };
  const done = run();
  if (done instanceof Promise) return done.finally(restore);
  restore();
  return undefined;
}

test('Lemon Squeezy provider is selected and reported ready when configured', () =>
  withLemonEnv(() => {
    const provider = getBillingProvider();
    assert.equal(provider.id, 'lemonsqueezy');
    assert.equal(provider.configured(), true);
    const status = billingStatus();
    assert.equal(status.provider, 'lemonsqueezy');
    assert.ok(status.readiness.some((r) => r.provider === 'lemonsqueezy' && r.configured));
  }));

test('Lemon Squeezy checkout converts KWD to USD cents and forwards project metadata', async () =>
  withLemonEnv(async () => {
    const captured: { url?: string; init?: any } = {};
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (url: any, init: any) => {
      captured.url = String(url);
      captured.init = init;
      return {
        ok: true,
        json: async () => ({
          data: { id: 'chk_abc', attributes: { url: 'https://academicos.lemonsqueezy.com/checkout/chk_abc' } },
        }),
      } as any;
    }) as typeof fetch;
    try {
      const provider = getBillingProvider();
      const result = await provider.createCheckout({
        customerEmail: 'buyer@example.com',
        customerName: 'Global Buyer',
        successUrl: 'https://app.example.com/success',
        cancelUrl: 'https://app.example.com/cancel',
        webhookUrl: 'https://app.example.com/api/billing/webhook/lemonsqueezy',
        tenantId: 'tenant-1',
        userId: 'user-1',
        projectId: 'project-1',
        idempotencyKey: 'idem-1',
        planId: 'project_viva',
        amountKwd: 6.9,
        description: 'AcademicOS — المشروع + المناقشة — بحثي',
      });
      assert.equal(result.url, 'https://academicos.lemonsqueezy.com/checkout/chk_abc');
      assert.equal(result.externalId, 'chk_abc');
      assert.equal(captured.url, 'https://api.lemonsqueezy.com/v1/checkouts');
      assert.match(String(captured.init.headers.Authorization), /Bearer test-api-key/);
      const payload = JSON.parse(captured.init.body);
      // 6.9 KWD * 3.26 * 100 = 2249 cents (USD)
      assert.equal(payload.data.attributes.custom_price, 2249);
      assert.equal(payload.data.relationships.store.data.id, '55555');
      assert.equal(payload.data.relationships.variant.data.id, '99999');
      const custom = payload.data.attributes.checkout_data.custom;
      assert.equal(custom.tenantId, 'tenant-1');
      assert.equal(custom.userId, 'user-1');
      assert.equal(custom.projectId, 'project-1');
      assert.equal(custom.planId, 'project_viva');
      assert.equal(payload.data.attributes.product_options.redirect_url, 'https://app.example.com/success');
    } finally {
      globalThis.fetch = originalFetch;
    }
  }));

function signedLemonWebhook(body: unknown, secret = 'test-webhook-secret') {
  const raw = Buffer.from(JSON.stringify(body));
  const signature = createHmac('sha256', secret).update(raw).digest('hex');
  return { raw, signature };
}

test('Lemon Squeezy webhook verifies signature, maps paid status, and preserves metadata', () =>
  withLemonEnv(() => {
    const body = {
      meta: {
        event_name: 'order_created',
        custom_data: { tenantId: 'tenant-1', userId: 'user-1', projectId: 'project-1', planId: 'project_viva' },
      },
      data: { id: 'ord_1', attributes: { status: 'paid', total: 2249, total_usd: 2249, currency: 'USD', refunded: false } },
    };
    const { raw, signature } = signedLemonWebhook(body);
    const event = verifyLemonSqueezyWebhook(raw, signature);
    assert.equal(event.provider, 'lemonsqueezy');
    assert.equal(event.status, 'paid');
    assert.equal(event.tenantId, 'tenant-1');
    assert.equal(event.userId, 'user-1');
    assert.equal(event.projectId, 'project-1');
    assert.equal(event.planId, 'project_viva');
    assert.equal(event.externalId, 'ord_1');
    assert.equal(event.amount, 22.49);
    assert.equal(event.currency, 'USD');
    // A forged signature must be rejected.
    assert.throws(() => verifyLemonSqueezyWebhook(raw, '0'.repeat(64)), /Invalid Lemon Squeezy/);
    // A tampered body (amount inflated) no longer matches the original signature.
    const tampered = Buffer.from(JSON.stringify({ ...body, data: { ...body.data, attributes: { ...body.data.attributes, total: 999999 } } }));
    assert.throws(() => verifyLemonSqueezyWebhook(tampered, signature), /Invalid Lemon Squeezy/);
  }));

test('Lemon Squeezy webhook maps refunded and non-paid states correctly', () =>
  withLemonEnv(() => {
    const base = {
      meta: { event_name: 'order_refunded', custom_data: { tenantId: 't', userId: 'u', projectId: 'p', planId: 'project' } },
      data: { id: 'ord_2', attributes: { status: 'paid', total_usd: 1500, currency: 'USD', refunded: true } },
    };
    const refunded = signedLemonWebhook(base);
    assert.equal(verifyLemonSqueezyWebhook(refunded.raw, refunded.signature).status, 'refunded');

    const pendingBody = { ...base, data: { id: 'ord_3', attributes: { status: 'pending', total_usd: 1500, currency: 'USD', refunded: false } } };
    const pending = signedLemonWebhook(pendingBody);
    assert.equal(verifyLemonSqueezyWebhook(pending.raw, pending.signature).status, 'pending');
  }));
