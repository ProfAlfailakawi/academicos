import { createHmac, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import type { PlatformRecord } from '../types';
import { platformStore } from './platform-store';

export interface WebhookEventPayload { id:string; type:string; tenantId:string; createdAt:string; data:Record<string,unknown> }

function secretFromRecord(record:PlatformRecord){const key=String(record.data?.signingSecretEnvKey||'');return key?process.env[key]:undefined;}

function privateAddress(address:string){
  const normalized=address.toLowerCase();
  if(normalized.startsWith('::ffff:'))return privateAddress(normalized.slice(7));
  if(isIP(normalized)===4){const parts=normalized.split('.').map(Number);const [a,b]=parts;return a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===100&&b>=64&&b<=127);}
  if(isIP(normalized)===6)return normalized==='::'||normalized==='::1'||normalized.startsWith('fc')||normalized.startsWith('fd')||/^fe[89ab]/.test(normalized);
  return true;
}

async function safeDestination(raw:string){
  let url:URL;try{url=new URL(raw)}catch{throw new Error('Webhook URL is invalid')}
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443')throw new Error('Webhook URL must use HTTPS on port 443 without embedded credentials');
  const addresses=await lookup(url.hostname,{all:true,verbatim:true});
  if(!addresses.length||addresses.some(item=>privateAddress(item.address)))throw new Error('Webhook destination resolves to a restricted network');
  return{url,address:addresses[0]};
}

async function deliver(rawUrl:string,headers:Record<string,string>,body:string){
  const {url,address}=await safeDestination(rawUrl);
  return await new Promise<{ok:boolean;status:number}>((resolve,reject)=>{
    const request=httpsRequest(url,{method:'POST',headers,servername:url.hostname,lookup:((_hostname:any,_options:any,callback:any)=>callback(null,address.address,address.family)) as any,timeout:10_000},response=>{response.resume();resolve({ok:Boolean(response.statusCode&&response.statusCode>=200&&response.statusCode<300),status:Number(response.statusCode||0)});});
    request.on('timeout',()=>request.destroy(new Error('Webhook delivery timed out')));request.on('error',reject);request.end(body);
  });
}

export async function emitWebhookEvent(tenantId:string,type:string,data:Record<string,unknown>){
  const hooks=(await platformStore.list('webhooks',tenantId,{limit:100,status:'active'})).filter(h=>Array.isArray(h.data?.events)&&(h.data.events as unknown[]).map(String).includes(type));
  const payload:WebhookEventPayload={id:randomUUID(),type,tenantId,createdAt:new Date().toISOString(),data};const body=JSON.stringify(payload);const results=[];
  for(const hook of hooks){
    const url=String(hook.data?.url||'');const secret=secretFromRecord(hook);if(!url||!/^https:\/\//i.test(url)){results.push({id:hook.id,ok:false,error:'Webhook URL must be HTTPS'});continue;}
    if(!secret){results.push({id:hook.id,ok:false,error:'Signing secret is not configured in the referenced environment variable'});continue;}
    const timestamp=Math.floor(Date.now()/1000).toString();const signature=createHmac('sha256',secret).update(`${timestamp}.${body}`).digest('hex');
    try{const response=await deliver(url,{'Content-Type':'application/json','Content-Length':String(Buffer.byteLength(body)),'User-Agent':'AcademicOS-Webhooks/1.0','X-AcademicOS-Event':type,'X-AcademicOS-Timestamp':timestamp,'X-AcademicOS-Signature':`v1=${signature}`},body);results.push({id:hook.id,ok:response.ok,status:response.status});}
    catch(error:any){results.push({id:hook.id,ok:false,error:String(error?.message||'delivery failed').slice(0,300)});}
  }
  return {event:payload,deliveries:results};
}
