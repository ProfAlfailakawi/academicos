import { createHmac, timingSafeEqual } from 'node:crypto';

export type BillingProviderId = 'disabled' | 'stripe' | 'tap' | 'myfatoorah' | 'lemonsqueezy';
export type BillingPlanId = 'preview' | 'project' | 'project_viva' | 'group';

export const BILLING_PLANS = [
  { id: 'preview', name: 'معاينة مجانية', amountKwd: 0, pages: 3, projects: 1, description: 'تحليل التكليف وثلاث صفحات تجريبية' },
  { id: 'project', name: 'المشروع الكامل', amountKwd: 4.9, pages: 20, projects: 1, description: 'مشروع كامل، X-Ray، Word وتعديلات الأقسام' },
  { id: 'project_viva', name: 'المشروع + المناقشة', amountKwd: 6.9, pages: 25, projects: 1, description: 'كل مزايا المشروع مع تدريب مناقشة مخصص' },
  { id: 'group', name: 'مشروع المجموعة', amountKwd: 8.9, pages: 35, projects: 1, description: 'مساحة فريق وأدوار وتسليم موحد' },
] as const;

export function billingPlan(planId: string) {
  return BILLING_PLANS.find((plan) => plan.id === planId);
}

export interface BillingCheckoutInput {
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  cancelUrl: string;
  webhookUrl: string;
  tenantId: string;
  userId: string;
  projectId: string;
  idempotencyKey: string;
  planId: Exclude<BillingPlanId, 'preview'>;
  amountKwd: number;
  description: string;
}

export interface BillingProvider {
  id: BillingProviderId;
  configured(): boolean;
  createCheckout(input: BillingCheckoutInput): Promise<{ url: string; externalId?: string }>;
}

const requestTimeout = () => Math.min(30_000, Math.max(3_000, Number(process.env.BILLING_REQUEST_TIMEOUT_MS || 15_000)));
async function providerJson(url:string,init:RequestInit){
  const response=await fetch(url,{...init,signal:AbortSignal.timeout(requestTimeout())});
  const json:any=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(json?.error?.message||json?.Message||json?.message||json?.errors?.[0]?.detail||'Billing provider request failed'),{code:'BILLING_PROVIDER_ERROR',status:502});
  return json;
}

class DisabledBillingProvider implements BillingProvider {
  id = 'disabled' as const;
  configured() { return false; }
  async createCheckout(): Promise<{ url: string }> { throw Object.assign(new Error('Billing provider is not configured'), { code: 'BILLING_NOT_CONFIGURED' }); }
}

class StripeBillingProvider implements BillingProvider {
  id = 'stripe' as const;
  configured() { return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET); }
  async createCheckout(input: BillingCheckoutInput) {
    if (!this.configured()) throw Object.assign(new Error('Stripe credentials or webhook secret are not configured'), { code: 'BILLING_NOT_CONFIGURED' });
    const body = new URLSearchParams();
    body.set('mode', 'payment'); body.set('success_url', input.successUrl); body.set('cancel_url', input.cancelUrl);
    body.set('line_items[0][price_data][currency]', 'kwd'); body.set('line_items[0][price_data][unit_amount]', String(Math.round(input.amountKwd * 1000))); body.set('line_items[0][price_data][product_data][name]', input.description); body.set('line_items[0][quantity]', '1');
    if (input.customerEmail) body.set('customer_email', input.customerEmail);
    body.set('metadata[tenantId]', input.tenantId); body.set('metadata[userId]', input.userId); body.set('metadata[projectId]', input.projectId); body.set('metadata[planId]', input.planId);
    body.set('payment_intent_data[metadata][tenantId]', input.tenantId); body.set('payment_intent_data[metadata][userId]', input.userId); body.set('payment_intent_data[metadata][projectId]', input.projectId); body.set('payment_intent_data[metadata][planId]', input.planId);
    const json = await providerJson('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key':input.idempotencyKey }, body });
    if (!json.url) throw Object.assign(new Error('Stripe did not return a hosted checkout URL'), { code: 'BILLING_PROVIDER_ERROR', status:502 });
    return { url: String(json.url), externalId:String(json.id||'')||undefined };
  }
}

class TapBillingProvider implements BillingProvider {
  id='tap' as const;
  configured(){return Boolean(process.env.TAP_SECRET_KEY&&process.env.TAP_MERCHANT_ID);}
  async createCheckout(input:BillingCheckoutInput){
    if(!this.configured())throw Object.assign(new Error('Tap credentials or merchant ID are not configured'),{code:'BILLING_NOT_CONFIGURED'});
    const json=await providerJson('https://api.tap.company/v2/charges/',{method:'POST',headers:{Authorization:`Bearer ${process.env.TAP_SECRET_KEY}`,'Content-Type':'application/json','Idempotency-Key':input.idempotencyKey},body:JSON.stringify({amount:input.amountKwd,currency:'KWD',customer_initiated:true,threeDSecure:true,save_card:false,description:input.description,metadata:{tenantId:input.tenantId,userId:input.userId,projectId:input.projectId,planId:input.planId,idempotencyKey:input.idempotencyKey},reference:{transaction:input.idempotencyKey,order:input.idempotencyKey},receipt:{email:Boolean(input.customerEmail),sms:false},customer:{first_name:(input.customerName||'AcademicOS').slice(0,80),email:input.customerEmail},merchant:{id:process.env.TAP_MERCHANT_ID},source:{id:process.env.TAP_SOURCE_ID||'src_kw.knet'},post:{url:input.webhookUrl},redirect:{url:input.successUrl}})});
    const url=String(json?.transaction?.url||'');if(!url.startsWith('https://'))throw Object.assign(new Error('Tap did not return a hosted checkout URL'),{code:'BILLING_PROVIDER_ERROR',status:502});
    return{url,externalId:String(json.id||'')||undefined};
  }
}

class MyFatoorahBillingProvider implements BillingProvider {
  id='myfatoorah' as const;
  configured(){return Boolean(process.env.MYFATOORAH_API_TOKEN&&process.env.MYFATOORAH_PAYMENT_METHOD_ID&&process.env.MYFATOORAH_WEBHOOK_SECRET);}
  async createCheckout(input:BillingCheckoutInput){
    if(!this.configured())throw Object.assign(new Error('MyFatoorah token, payment method, or webhook secret are not configured'),{code:'BILLING_NOT_CONFIGURED'});
    const base=(process.env.MYFATOORAH_API_BASE_URL||'https://api.myfatoorah.com').replace(/\/$/,'');if(!/^https:\/\/(api|apitest)\.myfatoorah\.com$/.test(base))throw Object.assign(new Error('MyFatoorah API host is not allowlisted'),{code:'BILLING_NOT_CONFIGURED'});
    const json=await providerJson(`${base}/v2/ExecutePayment`,{method:'POST',headers:{Authorization:`Bearer ${process.env.MYFATOORAH_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({InvoiceValue:input.amountKwd,PaymentMethodId:Number(process.env.MYFATOORAH_PAYMENT_METHOD_ID),CustomerName:(input.customerName||'AcademicOS user').slice(0,100),CustomerEmail:input.customerEmail,DisplayCurrencyIso:'KWD',CallBackUrl:input.successUrl,ErrorUrl:input.cancelUrl,Language:'AR',CustomerReference:input.projectId,UserDefinedField:JSON.stringify({tenantId:input.tenantId,userId:input.userId,projectId:input.projectId,planId:input.planId,idempotencyKey:input.idempotencyKey}).slice(0,500)})});
    const url=String(json?.Data?.PaymentURL||'');if(!url.startsWith('https://'))throw Object.assign(new Error('MyFatoorah did not return a hosted checkout URL'),{code:'BILLING_PROVIDER_ERROR',status:502});
    return{url,externalId:String(json?.Data?.InvoiceId||'')||undefined};
  }
}

class LemonSqueezyBillingProvider implements BillingProvider {
  id='lemonsqueezy' as const;
  configured(){return Boolean(process.env.LEMONSQUEEZY_API_KEY&&process.env.LEMONSQUEEZY_STORE_ID&&process.env.LEMONSQUEEZY_VARIANT_ID&&process.env.LEMONSQUEEZY_WEBHOOK_SECRET);}
  async createCheckout(input:BillingCheckoutInput){
    if(!this.configured())throw Object.assign(new Error('Lemon Squeezy API key, store, variant, or webhook secret are not configured'),{code:'BILLING_NOT_CONFIGURED'});
    const rate=Math.max(0.1,Number(process.env.LEMONSQUEEZY_KWD_USD_RATE||3.26));
    const cents=Math.max(1,Math.round(input.amountKwd*rate*100));
    const custom={tenantId:input.tenantId,userId:input.userId,projectId:input.projectId,planId:input.planId,idempotencyKey:input.idempotencyKey};
    const json=await providerJson('https://api.lemonsqueezy.com/v1/checkouts',{method:'POST',headers:{Authorization:`Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,'Content-Type':'application/vnd.api+json',Accept:'application/vnd.api+json'},body:JSON.stringify({data:{type:'checkouts',attributes:{custom_price:cents,product_options:{name:input.description.slice(0,255),redirect_url:input.successUrl},checkout_data:{email:input.customerEmail,name:(input.customerName||'AcademicOS user').slice(0,255),custom}},relationships:{store:{data:{type:'stores',id:String(process.env.LEMONSQUEEZY_STORE_ID)}},variant:{data:{type:'variants',id:String(process.env.LEMONSQUEEZY_VARIANT_ID)}}}}})});
    const url=String(json?.data?.attributes?.url||'');if(!url.startsWith('https://'))throw Object.assign(new Error('Lemon Squeezy did not return a hosted checkout URL'),{code:'BILLING_PROVIDER_ERROR',status:502});
    return{url,externalId:String(json?.data?.id||'')||undefined};
  }
}

export function getBillingProvider(): BillingProvider {
  const provider = String(process.env.BILLING_PROVIDER || 'disabled').toLowerCase();
  if (provider === 'stripe') return new StripeBillingProvider();
  if (provider === 'tap') return new TapBillingProvider();
  if (provider === 'myfatoorah') return new MyFatoorahBillingProvider();
  if (provider === 'lemonsqueezy') return new LemonSqueezyBillingProvider();
  return new DisabledBillingProvider();
}

export function billingStatus() {
  const active = getBillingProvider();
  const readiness = [new StripeBillingProvider(),new TapBillingProvider(),new MyFatoorahBillingProvider(),new LemonSqueezyBillingProvider()].map(provider=>({provider:provider.id,configured:provider.configured()}));
  return { provider: active.id, configured: active.configured(), readiness, plans: BILLING_PLANS };
}

export interface VerifiedPaymentEvent {provider:'tap'|'myfatoorah'|'lemonsqueezy';eventId:string;tenantId:string;userId:string;projectId?:string;planId?:string;externalId:string;status:'paid'|'failed'|'pending'|'refunded'|'chargeback';amount:number;currency:string;rawType:string}
function equalSignature(expected:string,provided:string){const a=Buffer.from(expected),b=Buffer.from(provided);return a.length===b.length&&timingSafeEqual(a,b);}

export function verifyTapWebhook(raw:Buffer,signature:string):VerifiedPaymentEvent{
  const secret=String(process.env.TAP_SECRET_KEY||'');if(!secret||!signature)throw Object.assign(new Error('Tap webhook is not configured'),{status:503,code:'TAP_WEBHOOK_NOT_CONFIGURED'});
  const body=JSON.parse(raw.toString('utf8'));const currency=String(body.currency||'').toUpperCase();const decimals=['BHD','KWD','OMR','JOD'].includes(currency)?3:2;const amount=Number(body.amount||0);const material=`x_id${body.id||''}x_amount${amount.toFixed(decimals)}x_currency${currency}x_gateway_reference${body.reference?.gateway||''}x_payment_reference${body.reference?.payment||''}x_status${body.status||''}x_created${body.transaction?.created||body.created||''}`;
  const expected=createHmac('sha256',secret).update(material).digest('hex');if(!equalSignature(expected,signature))throw Object.assign(new Error('Invalid Tap webhook signature'),{status:401,code:'TAP_SIGNATURE_INVALID'});
  const state=String(body.status||'').toUpperCase();const status:VerifiedPaymentEvent['status']=state==='CAPTURED'?'paid':state==='REFUNDED'?'refunded':state.includes('CHARGEBACK')||state.includes('DISPUTE')?'chargeback':state.includes('FAILED')||state==='DECLINED'||state==='CANCELLED'?'failed':'pending';
  return{provider:'tap',eventId:`${String(body.id||'')}:${state}:${String(body.reference?.payment||'')}`,tenantId:String(body.metadata?.tenantId||''),userId:String(body.metadata?.userId||''),projectId:String(body.metadata?.projectId||'')||undefined,planId:String(body.metadata?.planId||'')||undefined,externalId:String(body.id||''),status,amount,currency,rawType:state};
}

export function verifyMyFatoorahWebhook(raw:Buffer,signature:string):VerifiedPaymentEvent{
  const secret=String(process.env.MYFATOORAH_WEBHOOK_SECRET||'');if(!secret||!signature)throw Object.assign(new Error('MyFatoorah webhook is not configured'),{status:503,code:'MYFATOORAH_WEBHOOK_NOT_CONFIGURED'});
  const body=JSON.parse(raw.toString('utf8')),payment=body?.Data?.Payment||body?.Data||{},invoice=payment?.Invoice||{},transaction=payment?.Transaction||{};
  const material=`Invoice.Id=${invoice.Id??''},Invoice.Status=${invoice.Status??''},Transaction.Status=${transaction.Status??''},Transaction.PaymentId=${transaction.PaymentId??''},Invoice.ExternalIdentifier=${invoice.ExternalIdentifier??''}`;
  const expected=createHmac('sha256',secret).update(material).digest('base64');if(!equalSignature(expected,signature))throw Object.assign(new Error('Invalid MyFatoorah webhook signature'),{status:401,code:'MYFATOORAH_SIGNATURE_INVALID'});
  let metadata:any={};try{metadata=JSON.parse(String(invoice.UserDefinedField||''));}catch{metadata={};}const invoiceState=String(invoice.Status||'').toUpperCase(),transactionState=String(transaction.Status||'').toUpperCase();const status:VerifiedPaymentEvent['status']=invoiceState==='PAID'&&transactionState==='SUCCESS'?'paid':invoiceState==='REFUNDED'?'refunded':invoiceState.includes('CHARGEBACK')||transactionState.includes('CHARGEBACK')||transactionState.includes('DISPUTE')?'chargeback':invoiceState==='FAILED'||transactionState==='FAILED'?'failed':'pending';
  return{provider:'myfatoorah',eventId:`${String(body?.Event?.Reference||transaction.PaymentId||invoice.Id||'')}:${invoiceState}:${transactionState}`,tenantId:String(metadata.tenantId||''),userId:String(metadata.userId||''),projectId:String(metadata.projectId||'')||undefined,planId:String(metadata.planId||'')||undefined,externalId:String(transaction.PaymentId||invoice.Id||''),status,amount:Number(invoice.InvoiceValue||invoice.Value||0),currency:String(invoice.DisplayCurrencyIso||invoice.CurrencyIso||'KWD').toUpperCase(),rawType:String(body?.Event?.Name||'PAYMENT_STATUS_CHANGED')};
}

export function verifyLemonSqueezyWebhook(raw:Buffer,signature:string):VerifiedPaymentEvent{
  const secret=String(process.env.LEMONSQUEEZY_WEBHOOK_SECRET||'');if(!secret||!signature)throw Object.assign(new Error('Lemon Squeezy webhook is not configured'),{status:503,code:'LEMONSQUEEZY_WEBHOOK_NOT_CONFIGURED'});
  const expected=createHmac('sha256',secret).update(raw).digest('hex');if(!equalSignature(expected,signature))throw Object.assign(new Error('Invalid Lemon Squeezy webhook signature'),{status:401,code:'LEMONSQUEEZY_SIGNATURE_INVALID'});
  const body=JSON.parse(raw.toString('utf8')),custom=body?.meta?.custom_data||{},attributes=body?.data?.attributes||{};
  const eventName=String(body?.meta?.event_name||''),state=String(attributes.status||'').toLowerCase(),externalId=String(body?.data?.id||attributes.identifier||'');
  const status:VerifiedPaymentEvent['status']=attributes.refunded===true||state==='refunded'?'refunded':state==='paid'?'paid':state==='failed'||state==='void'?'failed':'pending';
  return{provider:'lemonsqueezy',eventId:`${externalId}:${eventName}:${state}`,tenantId:String(custom.tenantId||''),userId:String(custom.userId||''),projectId:String(custom.projectId||'')||undefined,planId:String(custom.planId||'')||undefined,externalId,status,amount:Number(attributes.total_usd||attributes.total||0)/100,currency:String(attributes.currency||'USD').toUpperCase(),rawType:eventName||'order_created'};
}
