const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const LOCALES = ['ar','en','tr','zh','hi','es','fr','ur'];
const checks = [];
const expect = (name, ok, detail='') => checks.push({name, ok: Boolean(ok), detail});
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function walk(rel, extRe=/\.(ts|tsx)$/) {
  const out=[];
  const base=path.join(root,rel);
  const recur=(dir)=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,e.name);
    if(e.isDirectory()) recur(p); else if(extRe.test(e.name)) out.push(p);
  }};
  recur(base); return out;
}

const uiPaths=[...walk('src/pages'),...walk('src/components')];
const allSourcePaths=[...walk('src'),path.join(root,'server.ts')].filter((v,i,a)=>a.indexOf(v)===i);
const uiCorpus=uiPaths.map(p=>fs.readFileSync(p,'utf8')).join('\n');
const app=read('src/App.tsx');
const layout=read('src/components/Layout.tsx');
const css=read('src/index.css');
const html=read('index.html');
const bootstrap=read('public/locale-bootstrap.js');
const auth=read('src/contexts/AuthContext.tsx');
const platformHub=read('src/pages/PlatformHub.tsx');
const integrations=read('src/pages/Integrations.tsx');
const statusPill=read('src/components/StatusPill.tsx');

function parse(rel) {
  const p=path.join(root,rel), text=fs.readFileSync(p,'utf8');
  return {text, sf:ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS)};
}

function getVariableObject(rel, varName) {
  const {sf}=parse(rel); let obj=null;
  const visit=(n)=>{
    if(ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text===varName && n.initializer && ts.isObjectLiteralExpression(n.initializer)) obj=n.initializer;
    ts.forEachChild(n,visit);
  }; visit(sf); return {sf,obj};
}

const messageKeys=new Set();
let duplicateMessageKeys=[];
let localeShapeErrors=[];
{
  const {sf,obj}=getVariableObject('src/lib/i18n-messages.ts','MESSAGES');
  if(!obj) localeShapeErrors.push('MESSAGES object not found');
  else {
    for(const prop of obj.properties){
      if(!ts.isPropertyAssignment(prop)) continue;
      const name=ts.isStringLiteral(prop.name)||ts.isIdentifier(prop.name)?prop.name.text:null;
      if(!name) continue;
      if(messageKeys.has(name)) duplicateMessageKeys.push(name); else messageKeys.add(name);
      const init=prop.initializer;
      if(ts.isCallExpression(init) && ts.isIdentifier(init.expression) && init.expression.text==='UI') {
        if(init.arguments.length!==8) localeShapeErrors.push(`${name}: UI has ${init.arguments.length} locales`);
      } else if(ts.isObjectLiteralExpression(init)) {
        const codes=init.properties.filter(ts.isPropertyAssignment).map(p=>ts.isIdentifier(p.name)||ts.isStringLiteral(p.name)?p.name.text:'').filter(Boolean);
        const missing=LOCALES.filter(c=>!codes.includes(c));
        const extras=codes.filter(c=>!LOCALES.includes(c));
        if(missing.length||extras.length||codes.length!==8) localeShapeErrors.push(`${name}: missing=[${missing}] extras=[${extras}] count=${codes.length}`);
      } else {
        localeShapeErrors.push(`${name}: unsupported locale entry shape`);
      }
    }
  }
}

const baseKeys=new Set(); let baseLocaleErrors=[];
{
  const {obj}=getVariableObject('src/lib/i18n.tsx','DICT');
  if(!obj) baseLocaleErrors.push('DICT object not found');
  else for(const prop of obj.properties){
    if(ts.isSpreadAssignment(prop)) continue;
    if(!ts.isPropertyAssignment(prop)) continue;
    const name=ts.isStringLiteral(prop.name)||ts.isIdentifier(prop.name)?prop.name.text:null;
    if(name) baseKeys.add(name);
    const init=prop.initializer;
    if(ts.isCallExpression(init) && ts.isIdentifier(init.expression) && init.expression.text==='S' && init.arguments.length!==8) baseLocaleErrors.push(`${name}: S has ${init.arguments.length} locales`);
  }
}
const allKeys=new Set([...baseKeys,...messageKeys]);

const referencedLiteralKeys=new Set();
for(const p of allSourcePaths){
  const text=fs.readFileSync(p,'utf8'); const sf=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const visit=(n)=>{
    if(ts.isCallExpression(n) && ts.isIdentifier(n.expression) && ['t','tr'].includes(n.expression.text) && n.arguments.length && (ts.isStringLiteral(n.arguments[0])||ts.isNoSubstitutionTemplateLiteral(n.arguments[0]))) referencedLiteralKeys.add(n.arguments[0].text);
    ts.forEachChild(n,visit);
  }; visit(sf);
}
const missingKeys=[...referencedLiteralKeys].filter(k=>!allKeys.has(k)).sort();

const physicalClassHits=[];
const physicalRe=/(^|\s)(?:left|right|ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r|text-left|text-right)-[^\s"'`}]+/g;
for(const p of uiPaths){
  const rel=path.relative(root,p), text=fs.readFileSync(p,'utf8'); let m;
  while((m=physicalRe.exec(text))) physicalClassHits.push(`${rel}: ${m[0].trim()}`);
}

const directLocaleFormatting=[];
for(const p of uiPaths){
  const rel=path.relative(root,p), text=fs.readFileSync(p,'utf8');
  if(/\.toLocale(?:String|DateString|TimeString)\s*\(/.test(text) || /document\.documentElement\.lang/.test(text)) directLocaleFormatting.push(rel);
}

const visibleArabic=[];
for(const p of uiPaths){
  const rel=path.relative(root,p), text=fs.readFileSync(p,'utf8');
  const sf=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const visit=(n)=>{
    if(ts.isJsxText(n)){
      const v=n.getText(sf).replace(/\s+/g,' ').trim();
      if(/[\u0600-\u06ff]/.test(v)) { const lc=sf.getLineAndCharacterOfPosition(n.getStart(sf)); visibleArabic.push(`${rel}:${lc.line+1}: ${v}`); }
    }
    ts.forEachChild(n,visit);
  }; visit(sf);
}
const visibleLiteralLeaks=[];
// Academic + OS are the two halves of the wordmark (brand, never translated);
// Enter is a keyboard key name, allowed on the same grounds as ESC.
const allowedVisibleLiteral=/^(?:L|ProfessorOS|ProfessorOS ·|· AI L|AO|AcademicOS|AcademicOS —|AcademicOS ·|Academic|OS|v|K|ESC|Enter|SHA-256(?: ·)?|DOI|doi:|BibTeX|Word)$/;
for(const p of uiPaths){
  const rel=path.relative(root,p), text=fs.readFileSync(p,'utf8');
  const sf=ts.createSourceFile(p,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const visit=(n)=>{
    if(ts.isJsxText(n)){
      const v=n.getText(sf).replace(/\s+/g,' ').trim();
      if(v && /[A-Za-z\u0600-\u06ff\u4e00-\u9fff]/.test(v) && !allowedVisibleLiteral.test(v)) {
        const lc=sf.getLineAndCharacterOfPosition(n.getStart(sf)); visibleLiteralLeaks.push(`${rel}:${lc.line+1}: ${v}`);
      }
    }
    ts.forEachChild(n,visit);
  }; visit(sf);
}

const mainPos=html.search(/<script[^>]+src=["']\/src\/main\.tsx["']/i);
const bootPos=html.search(/<script[^>]+src=["']\/locale-bootstrap\.js["']/i);

expect('i18n message keys are unique', duplicateMessageKeys.length===0, duplicateMessageKeys.join(', '));
expect('Every external message has all 8 launch locales', localeShapeErrors.length===0, localeShapeErrors.slice(0,12).join(' | '));
expect('Every base DICT S() entry has 8 launch locales', baseLocaleErrors.length===0, baseLocaleErrors.slice(0,12).join(' | '));
expect('All literal t()/tr() references resolve', missingKeys.length===0, missingKeys.slice(0,20).join(', '));
// عناصر التنقّل تُمرّر مفاتيحها كخصائص (label/short) لا كنصوص حرفية داخل t()،
// فلا يلتقطها الفحص أعلاه. تُفحص هنا صراحةً كي لا يتسرّب مفتاح خام إلى الشريط.
const navKeyMisses=[...layout.matchAll(/(?:label|short):\s*"([a-zA-Z]+\.[a-zA-Z]+)"/g)]
  .map(m=>m[1]).filter((k,i,a)=>a.indexOf(k)===i)
  .filter(k=>!allKeys.has(k));
expect('Navigation labels resolve to real translations', navKeyMisses.length===0, navKeyMisses.join(', '));
expect('No physical left/right Tailwind utilities in routed UI', physicalClassHits.length===0, physicalClassHits.slice(0,12).join(' | '));
expect('UI date/time formatting is locale-state driven', directLocaleFormatting.length===0, directLocaleFormatting.join(', '));
expect('No hard-coded Arabic JSX leaks outside i18n', visibleArabic.length===0, visibleArabic.slice(0,12).join(' | '));
expect('No translatable visible JSX literals bypass i18n', visibleLiteralLeaks.length===0, visibleLiteralLeaks.slice(0,12).join(' | '));
expect('Locale bootstrap runs before React', bootPos>=0 && mainPos>=0 && bootPos<mainPos, 'locale-bootstrap.js must be loaded before /src/main.tsx');
expect('Bootstrap supports 8 locales with English fallback', LOCALES.every(c=>bootstrap.includes(`"${c}"`)) && bootstrap.includes('code = code || "en"'), 'bootstrap locale list/fallback incomplete');
expect('App shell reserves fixed sidebar using logical direction', css.includes('inset-inline-start: 0') && css.includes('margin-inline-start: 276px') && css.includes('width: calc(100% - 276px)'), 'sidebar/content geometry must use inline logical properties');
expect('Mobile drawer close control is logical-direction aware', css.includes('.mobile-menu-close { inset-inline-end:'), 'mobile close button must follow start/end direction');
expect('Directional icons rotate under RTL', css.includes('html[dir="rtl"] .directional-icon'), 'chevrons/arrows need RTL orientation');
expect('Long translations cannot force app horizontal overflow', css.includes('overflow-wrap: anywhere') && css.includes('.app-shell { isolation: isolate; width: 100%; overflow-x: clip; }'), 'long translated labels need wrapping/overflow guard');
expect('Topbar has medium/mobile density rules', css.includes('@media (min-width: 1024px) and (max-width: 1535px)') && css.includes('.app-topbar .command-trigger') && css.includes('.language-switcher'), 'topbar should not collide at intermediate widths');
expect('Professor and coordinator retain ProfessorOS navigation', /"professor"[\s\S]{0,80}"course_coordinator"[\s\S]{0,420}\.includes\(user\.role\)/.test(layout), 'faculty nav must match App faculty guard');
expect('Platform runtime metadata is localized', platformHub.includes('platformResourceLabel') && platformHub.includes('platformResourceDescription') && platformHub.includes('platformStatusLabel'), 'Platform Hub must not display backend-localized metadata raw');
expect('Integration runtime metadata is localized', integrations.includes('integrationCategoryLabel') && integrations.includes('integrationModeLabel') && integrations.includes('integrationDescription'), 'Integrations must localize runtime metadata');
expect('Unknown status pills localize instead of leaking enum keys', statusPill.includes('runtimeEnumLabel(status, locale)'), 'StatusPill fallback should be locale-aware');
expect('No Kuwait-only product defaults in UI', !/(ar-KW|KWD|د\.ك|الكويت فقط|Kuwait-only)/i.test(uiCorpus), 'Kuwait may be selectable, never a UI default');
expect('Auth has no client-side fake session fallback', !/(academicos_local_user|demo_token|localUser|localStorage\.setItem\([^\n]*user)/i.test(auth), 'production auth must be Firebase-only');
expect('App routes keep global pages behind the shared Layout', app.includes('<Route path="/app" element={<ProtectedLayout />}>') && app.includes('<Route path="learn" element={<LearnStudio />} />'), 'protected app pages should inherit the same global shell');
expect('Student utility pages are real routes, not dead redirects', ['invitations','calendar','notifications','skills','passport','archive','jobs'].every((route) => app.includes(`<Route path="${route}"`) && !app.includes(`<Route path="${route}" element={<Navigate to="/app" replace />} />`)), 'existing utility pages should remain reachable without bloating primary navigation');
expect('Hidden academic tools remain discoverable', layout.includes('const utilityNav = useMemo') && layout.includes('layout.academicTools') && layout.includes('/app/notifications') && layout.includes('/app/passport'), 'utility routes should be searchable from the command palette');

for(const c of checks) console.log(`${c.ok?'PASS':'FAIL'}  ${c.name}${c.ok?'':` — ${c.detail}`}`);
const failed=checks.filter(c=>!c.ok);
console.log(`\n${checks.length-failed.length}/${checks.length} global UI invariants passed.`);
if(failed.length) process.exit(1);
