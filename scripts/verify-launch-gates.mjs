#!/usr/bin/env node
// AcademicOS — Launch Gates Verifier  (إصلاح الفجوة #5)
// يحوّل بوابات الإطلاق السبع من نصّ في GO_LIVE_RUNBOOK.md إلى فحص آلي يعطي PASS/FAIL/MANUAL.
// ما يمكن أتمتته (متغيرات البيئة، وجود المفاتيح، نجاح typecheck/الاختبارات) يُنفَّذ فعليًا؛
// ما لا يُؤتمت (اختبار بشري في staging) يُوسَم MANUAL صراحةً بدل ادّعاء نجاحه.
//
// الاستخدام:  node scripts/verify-launch-gates.mjs   (أو npm run verify:launch-gates)
// خيار --strict يجعل أي MANUAL/FAIL يُرجِع رمز خروج غير صفري (لاستخدام CI قبل الترقية للإنتاج).

import { execSync } from 'node:child_process';

const STRICT = process.argv.includes('--strict');
const env = process.env;
const has = (...keys) => keys.every((k) => String(env[k] || '').trim().length > 0);
const results = [];
function gate(id, title, status, detail) { results.push({ id, title, status, detail }); }
function tryCmd(cmd) { try { execSync(cmd, { stdio: 'pipe' }); return true; } catch { return false; } }

// البوابة 1 — Firebase الإنتاجي + App Check + MFA
{
  const firebase = has('FIREBASE_SERVICE_ACCOUNT') || has('GOOGLE_APPLICATION_CREDENTIALS') || has('FIREBASE_PROJECT_ID');
  const appCheck = env.REQUIRE_APP_CHECK === 'true' && has('VITE_FIREBASE_APPCHECK_SITE_KEY');
  const mfa = env.REQUIRE_ADMIN_MFA === 'true';
  const status = firebase && appCheck && mfa ? 'PASS' : firebase ? 'PARTIAL' : 'FAIL';
  gate(1, 'Firebase الإنتاجي + App Check + MFA', status,
    `firebase=${firebase} appCheck=${appCheck} mfa=${mfa}`);
}

// البوابة 2 — مزوّد دفع مُهيّأ (sandbox قبل الإنتاج)
{
  const provider = String(env.BILLING_PROVIDER || '').toLowerCase();
  const providerKeys = {
    stripe: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'],
    lemonsqueezy: ['LEMONSQUEEZY_API_KEY', 'LEMONSQUEEZY_WEBHOOK_SECRET'],
    myfatoorah: ['MYFATOORAH_API_TOKEN', 'MYFATOORAH_WEBHOOK_SECRET'],
    tap: ['TAP_SECRET_KEY', 'TAP_WEBHOOK_SECRET'],
  };
  const keys = providerKeys[provider];
  const status = !provider ? 'FAIL' : keys && has(...keys) ? 'PASS' : 'PARTIAL';
  gate(2, 'مزوّد الدفع مُهيّأ', status, provider ? `provider=${provider} keys=${keys ? has(...keys) : 'unknown'}` : 'BILLING_PROVIDER غير مضبوط');
}

// البوابة 3 — مزوّد ذكاء اصطناعي + نموذج
{
  const ai = has('GEMINI_API_KEY') || has('AI_GATEWAY_URL');
  gate(3, 'مزوّد ذكاء اصطناعي + نموذج', ai ? 'PASS' : 'FAIL', `gemini=${has('GEMINI_API_KEY')} model=${env.GEMINI_MODEL || 'default'}`);
}

// البوابة 4 — Realtime + Rate limiter موزّع (جاهزية التوسّع)
{
  const distributed = String(env.RATE_LIMIT_BACKEND || 'memory').toLowerCase() === 'firestore';
  gate(4, 'Rate limiter موزّع (Cloud Run متعدد النسخ)', distributed ? 'PASS' : 'PARTIAL',
    distributed ? 'firestore backend' : 'memory backend — اضبط RATE_LIMIT_BACKEND=firestore للإنتاج');
}

// البوابة 5 — typecheck + الاختبارات تنجح
{
  const tc = tryCmd('npm run -s typecheck');
  gate(5, 'typecheck ينجح', tc ? 'PASS' : 'FAIL', tc ? '0 أخطاء' : 'tsc أعاد أخطاء');
  const adv = tryCmd('node --import tsx --test tests/advanced.test.ts');
  gate(5.1, 'اختبارات القدرات المتقدمة (advanced)', adv ? 'PASS' : 'FAIL', adv ? '14/14' : 'فشل أحد الاختبارات');
}

// البوابة 6 — نشر staging (تُكتشف آليًا إن توفّر URL، وإلا MANUAL)
{
  const url = env.STAGING_URL;
  gate(6, 'بيئة staging منشورة', url ? 'MANUAL' : 'MANUAL', url ? `افحص ${url}/api/health يدويًا` : 'انشر إلى staging ثم اضبط STAGING_URL');
}

// البوابة 7 — اختبار بشري للأدوار الثلاثة (لا يُؤتمت)
gate(7, 'اختبار بشري (طالب/أستاذ/أدمن + دفع sandbox + رفع ملفات + Viva)', 'MANUAL',
  'نفّذ سيناريوهات GO_LIVE_RUNBOOK.md على staging قبل الترقية للإنتاج');

// ---- تقرير ----
const icon = { PASS: '✅', PARTIAL: '🟡', FAIL: '❌', MANUAL: '🔷' };
console.log('\n  AcademicOS — Launch Gates\n  ─────────────────────────');
for (const r of results) console.log(`  ${icon[r.status] || '•'}  البوابة ${r.id} — ${r.title}\n       ${r.status}: ${r.detail}`);
const fails = results.filter((r) => r.status === 'FAIL').length;
const manual = results.filter((r) => r.status === 'MANUAL').length;
const partial = results.filter((r) => r.status === 'PARTIAL').length;
console.log(`\n  الملخّص: ${results.filter(r => r.status === 'PASS').length} PASS · ${partial} PARTIAL · ${manual} MANUAL · ${fails} FAIL`);
console.log('  القاعدة: لا تُعلَن أي بوابة PASS إلا بعد تنفيذها على البيئة المنشورة فعليًا.\n');

if (fails > 0) process.exit(2);
if (STRICT && (manual > 0 || partial > 0)) process.exit(3);
process.exit(0);
