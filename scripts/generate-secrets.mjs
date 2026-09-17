#!/usr/bin/env node
/*
 * AcademicOS — يولّد الأسرار التي لا تأتي من مزوّد خارجي، جاهزة للّصق.
 *
 * أهمها زوج مفاتيح Ed25519 لتوقيع كبسولات الأدلة. صيغته ليست بديهية:
 * `EVIDENCE_CAPSULE_ED25519_PRIVATE_KEY_B64` هو **base64 لنصّ PEM بصيغة PKCS#8**،
 * بينما المفتاح العام الموثوق هو **base64url لـSPKI DER**. اختلاف الترميزين بين
 * الحقلين هو ما يجعل توليدهما يدوياً مصدر خطأ، فالسكربت يولّدهما ثم **يتحقق فعلياً**
 * بتوقيع رسالة والتحقق منها قبل أن يطبع أي شيء.
 *
 *   node scripts/generate-secrets.mjs
 *
 * تحذير: كل تشغيل يولّد قيماً جديدة. تغيير مفتاح التوقيع بعد الإطلاق يجعل كل
 * كبسولة وُقّعت سابقاً تبدو "موقّعة من جهة غير موثوقة" — أبقِ المفتاح القديم في
 * EVIDENCE_CAPSULE_TRUSTED_PUBLIC_KEYS إن دوّرته.
 */

import { generateKeyPairSync, createPublicKey, createPrivateKey, randomBytes, sign, verify } from 'node:crypto';

const secret = () => randomBytes(48).toString('base64url');

// ── زوج مفاتيح كبسولات الأدلة ────────────────────────────────────────────────
const { privateKey } = generateKeyPairSync('ed25519');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const privateKeyB64 = Buffer.from(privatePem).toString('base64');
const publicDer = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
const publicKeySpkiB64url = publicDer.toString('base64url');

/*
 * تحقّق فعلي لا افتراض: نعيد بناء المفتاح من الترميز الذي سنطبعه تماماً، ونوقّع
 * ونتحقق. لو كان الترميز خاطئاً لفشل هنا بدل أن يفشل في الإنتاج عند أول كبسولة.
 */
const rebuiltPrivate = createPrivateKey(Buffer.from(privateKeyB64, 'base64').toString('utf8'));
const rebuiltPublic = createPublicKey({ key: Buffer.from(publicKeySpkiB64url, 'base64url'), format: 'der', type: 'spki' });
const probe = Buffer.from('academicos-evidence-capsule-selftest');
const signature = sign(null, probe, rebuiltPrivate);
if (!verify(null, probe, rebuiltPublic, signature)) {
  console.error('توليد مفتاح Ed25519 فشل في التحقق الذاتي — لا تستعمل هذا الناتج.');
  process.exit(1);
}

console.log('\n# ── أسرار AcademicOS المولَّدة ────────────────────────────────');
console.log('# انسخها إلى .env أو إلى Secret Manager. لا تودعها في git.');
console.log('# (زوج Ed25519 اجتاز تحقّقاً ذاتياً: وُقِّعت رسالة وتُحقِّق منها بهذين الترميزين.)\n');

console.log('# اشتقاق ملفات التنويع لكل طالب — الإنتاج يفرضه (32 محرفاً على الأقل)');
console.log(`PROJECT_VARIATION_SECRET=${secret()}\n`);

console.log('# تجزئة إشارات إساءة الاستخدام — الإنتاج يرميه إن غاب');
console.log(`ABUSE_HASH_SECRET=${secret()}\n`);

console.log('# بديل احتياطي لسرّ التنويع');
console.log(`CSRF_SIGNING_SECRET=${secret()}\n`);

console.log('# مفتاح توقيع كبسولات الأدلة (base64 لـPEM/PKCS#8)');
console.log('# لا تغيّره بعد الإطلاق دون إبقاء العام القديم في قائمة الموثوقين أدناه.');
console.log(`EVIDENCE_CAPSULE_ED25519_PRIVATE_KEY_B64=${privateKeyB64}\n`);

console.log('# المفتاح العام المقابل (base64url لـSPKI DER) — ضعه في قائمة الموثوقين');
console.log('# حتى تُقرأ الكبسولات الموقَّعة بهذا المفتاح على أنها "موقَّعة من جهة موثوقة".');
console.log(`EVIDENCE_CAPSULE_TRUSTED_PUBLIC_KEYS=${publicKeySpkiB64url}\n`);

console.log('# ملاحظة: WHATSAPP_VERIFY_TOKEN سرّ تختاره أنت وتُدخله في لوحة Meta،');
console.log('# فلا بد أن يتطابق الطرفان. قيمة صالحة للاستعمال:');
console.log(`WHATSAPP_VERIFY_TOKEN=${secret()}\n`);
