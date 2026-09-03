import React, { useEffect, useState } from 'react';
import { Repeat, LoaderCircle, Plus, Trash2, Award, Target, Layers, Fingerprint } from 'lucide-react';
import { advancedApi } from '../../lib/api';
import type { ProjectDNA } from '../../types';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';

// Reverse Assessment — «اصنع الامتحان». الطالب يصمم أسئلة عن مشروعه، والمُقيّم الحتمي يعطي درجة صانع الامتحان.
interface Q { id: string; prompt: string; modelAnswer: string; targetOutcome?: string }

export function ReverseAssessmentStudio({ project }: { project: ProjectDNA }) {
  const [brief, setBrief] = useState<{ instruction: string; targets: string[] } | null>(null);
  const [questions, setQuestions] = useState<Q[]>([{ id: 'q1', prompt: '', modelAnswer: '' }]);
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { advancedApi.reverseAssessmentBrief(project.id).then(setBrief).catch(() => {}); }, [project.id]);

  const add = () => setQuestions(v => [...v, { id: `q${v.length + 1}`, prompt: '', modelAnswer: '' }]);
  const upd = (id: string, patch: Partial<Q>) => setQuestions(v => v.map(q => q.id === id ? { ...q, ...patch } : q));
  const del = (id: string) => setQuestions(v => v.filter(q => q.id !== id));

  async function evaluate() {
    setBusy(true); setError('');
    try { setResult(await advancedApi.reverseAssessment(project.id, questions.filter(q => q.prompt.trim()))); }
    catch (e: any) { setError(String(e?.message || e)); } finally { setBusy(false); }
  }

  return (
    <div className="grid xl:grid-cols-[1.15fr_.85fr] gap-5 items-start">
      <Card>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg,var(--accent-soft),transparent)' }}><Repeat size={20} style={{ color: 'var(--accent)' }} /></div>
            <div><div className="eyebrow">إثبات فهم من نوع جديد</div><h2 className="section-title mt-0.5">اصنع الامتحان 🔄</h2></div>
          </div>
          {brief && <p className="body-copy mt-3">{brief.instruction}</p>}
          {brief?.targets?.length ? <div className="mt-3 flex flex-wrap gap-1.5">{brief.targets.map(t => <span key={t} className="rounded-full soft-bg px-2 py-1 text-[10px] muted">{t}</span>)}</div> : null}

          <div className="mt-5 space-y-4">
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-2xl border hairline bg-[var(--bg)] p-4">
                <div className="flex items-center justify-between"><span className="text-[11px] font-bold brand-text">سؤال {i + 1}</span>{questions.length > 1 && <Button size="icon" variant="ghost" onClick={() => del(q.id)}><Trash2 size={14} /></Button>}</div>
                <textarea value={q.prompt} onChange={e => upd(q.id, { prompt: e.target.value })} placeholder="صِغ سؤالًا تحليليًا/تقويميًا عن مشروعك…" className="focus-ring w-full min-h-16 rounded-xl border hairline bg-[var(--panel)] p-3 text-sm leading-6 mt-2" />
                <textarea value={q.modelAnswer} onChange={e => upd(q.id, { modelAnswer: e.target.value })} placeholder="إجابة نموذجية موجزة (تثبت أنك تعرف الجواب)…" className="focus-ring w-full min-h-14 rounded-xl border hairline bg-[var(--panel)] p-3 text-sm leading-6 mt-2" />
                <select value={q.targetOutcome || ''} onChange={e => upd(q.id, { targetOutcome: e.target.value || undefined })} className="focus-ring w-full rounded-xl border hairline bg-[var(--panel)] px-3 py-2.5 text-sm mt-2">
                  <option value="">اربطه بمخرج تعلم (اختياري)…</option>
                  {(brief?.targets || []).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={add}><Plus size={16} />سؤال آخر</Button>
            <Button className="flex-1" onClick={evaluate} disabled={busy || !questions.some(q => q.prompt.trim())}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Award size={16} />}قيّم امتحاني</Button>
          </div>
          {error && <p className="text-xs text-[var(--danger)] mt-2">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {!result ? (
            <div className="py-10 text-center"><div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center" style={{ background: 'var(--accent-soft)' }}><Award style={{ color: 'var(--accent)' }} /></div><div className="text-sm font-semibold mt-3">درجة صانع الامتحان</div><p className="body-copy mt-1">صمّم أسئلتك ثم قيّمها. الأسئلة عالية المستوى (تحليل/تقويم/تصميم) ترفع درجتك.</p></div>
          ) : (
            <>
              <div className="text-center">
                <div className="eyebrow">درجة صانع الامتحان</div>
                <Gauge value={result.makerScore} band={result.band} />
                <BandLabel band={result.band} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <Dim icon={<Layers size={14} />} label="العمق الإدراكي" value={result.dimensions.depth} />
                <Dim icon={<Target size={14} />} label="التغطية" value={result.dimensions.coverage} />
                <Dim icon={<Fingerprint size={14} />} label="التمييز" value={result.dimensions.discrimination} />
                <Dim icon={<Award size={14} />} label="الإحكام" value={result.dimensions.rigor} />
              </div>
              {result.coverageGaps?.length ? (
                <div className="mt-4 rounded-xl px-3 py-2.5 text-xs leading-6" style={{ background: '#f7dede' }}>
                  <b>مخرجات لم يقسها أي سؤال:</b> {result.coverageGaps.join('، ')}
                </div>
              ) : null}
              {result.band !== 'surface' && <div className="mt-4 rounded-xl px-3 py-2.5 text-xs leading-6" style={{ background: 'var(--brand-soft)' }}>✅ أُضيف هذا كدليل <b>Proof of Learning</b> في Evidence Capsule.</div>}
              <p className="text-[10px] muted mt-4 leading-5">{result.note}</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Gauge({ value, band }: { value: number; band: string }) {
  const color = band === 'mastery' ? 'var(--success)' : band === 'developing' ? 'var(--accent)' : 'var(--danger)';
  const r = 52, c = 2 * Math.PI * r, off = c * (1 - value / 100);
  return (
    <div className="relative mx-auto mt-2" style={{ width: 140, height: 140 }}>
      <svg viewBox="0 0 140 140" className="-rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--panel-2)" strokeWidth="12" />
        <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center"><div className="text-3xl font-bold" style={{ color }}>{value}</div></div>
    </div>
  );
}
function BandLabel({ band }: { band: string }) {
  const m: Record<string, string> = { mastery: 'إتقان', developing: 'قيد التطوّر', surface: 'سطحي' };
  return <div className="text-sm font-semibold mt-1">{m[band] || band}</div>;
}
function Dim({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border hairline bg-[var(--bg)] p-3">
      <div className="flex items-center gap-1.5 text-[11px] muted brand-text">{icon}<span className="muted">{label}</span></div>
      <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--panel-2)' }}><div className="h-1.5 rounded-full brand-soft-bg" style={{ width: `${value}%`, background: 'var(--brand)' }} /></div>
      <div className="text-sm font-bold mt-1">{value}%</div>
    </div>
  );
}
