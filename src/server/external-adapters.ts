function configured(urlKey:string,tokenKey:string){return Boolean(process.env[urlKey]&&process.env[tokenKey]);}
function endpoint(urlKey:string){const value=String(process.env[urlKey]||'');if(!value)throw Object.assign(new Error(`${urlKey} is not configured`),{status:503,code:'INTEGRATION_NOT_CONFIGURED'});if(!value.startsWith('https://'))throw Object.assign(new Error(`${urlKey} must use HTTPS`),{status:500,code:'INTEGRATION_ENDPOINT_INVALID'});return value;}

async function jsonService<T>(urlKey:string,tokenKey:string,payload:unknown,timeout=30000):Promise<T>{
  const url=endpoint(urlKey);const token=String(process.env[tokenKey]||'');if(!token)throw Object.assign(new Error(`${tokenKey} is not configured`),{status:503,code:'INTEGRATION_NOT_CONFIGURED'});
  const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`},body:JSON.stringify(payload),signal:AbortSignal.timeout(timeout)});
  const body:any=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(body?.error||`External service failed with HTTP ${response.status}`),{status:502,code:'EXTERNAL_SERVICE_ERROR'});return body as T;
}

export const externalServices={
  pdf:{configured:()=>configured('PDF_RENDER_SERVICE_URL','PDF_RENDER_SERVICE_TOKEN'),async render(input:{html:string;filename:string}){const url=endpoint('PDF_RENDER_SERVICE_URL');const token=String(process.env.PDF_RENDER_SERVICE_TOKEN||'');if(!token)throw Object.assign(new Error('PDF renderer token is not configured'),{status:503,code:'PDF_RENDER_NOT_CONFIGURED'});const response=await fetch(url,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${token}`,'accept':'application/pdf'},body:JSON.stringify({html:input.html,filename:input.filename,printBackground:true,format:'A4'}),signal:AbortSignal.timeout(45000)});if(!response.ok)throw Object.assign(new Error(`PDF renderer failed with HTTP ${response.status}`),{status:502,code:'PDF_RENDER_FAILED'});const type=response.headers.get('content-type')||'';if(!type.includes('application/pdf'))throw Object.assign(new Error('PDF renderer returned an unexpected content type'),{status:502,code:'PDF_RENDER_INVALID'});return Buffer.from(await response.arrayBuffer());}},
  backup:{configured:()=>configured('BACKUP_WORKER_URL','BACKUP_WORKER_TOKEN'),run:<T=Record<string,unknown>>(payload:unknown)=>jsonService<T>('BACKUP_WORKER_URL','BACKUP_WORKER_TOKEN',payload,60000)},
  codeSandbox:{configured:()=>configured('CODE_SANDBOX_URL','CODE_SANDBOX_TOKEN'),run:<T=Record<string,unknown>>(payload:unknown)=>jsonService<T>('CODE_SANDBOX_URL','CODE_SANDBOX_TOKEN',payload,60000)},
  semantic:{configured:()=>configured('SEMANTIC_INDEX_URL','SEMANTIC_INDEX_TOKEN'),run:<T=Record<string,unknown>>(payload:unknown)=>jsonService<T>('SEMANTIC_INDEX_URL','SEMANTIC_INDEX_TOKEN',payload,45000)},
  translation:{configured:()=>configured('TRANSLATION_SERVICE_URL','TRANSLATION_SERVICE_TOKEN'),run:<T=Record<string,unknown>>(payload:unknown)=>jsonService<T>('TRANSLATION_SERVICE_URL','TRANSLATION_SERVICE_TOKEN',payload,30000)},
  crm:{configured:()=>configured('CRM_WEBHOOK_URL','CRM_WEBHOOK_TOKEN'),run:<T=Record<string,unknown>>(payload:unknown)=>jsonService<T>('CRM_WEBHOOK_URL','CRM_WEBHOOK_TOKEN',payload,15000)},
  virusScan:{configured:()=>configured('VIRUS_SCAN_URL','VIRUS_SCAN_TOKEN'),run:<T={clean:boolean;engine?:string;signature?:string}>(payload:unknown)=>jsonService<T>('VIRUS_SCAN_URL','VIRUS_SCAN_TOKEN',payload,45000)},
};
