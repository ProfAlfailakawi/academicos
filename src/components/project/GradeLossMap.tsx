import React, { useEffect, useState } from 'react';
import { Droplet, LoaderCircle, AlertTriangle, ShieldCheck, Eye } from 'lucide-react';
import { advancedApi } from '../../lib/api';
import type { ProjectDNA } from '../../types';
import { Card, CardContent } from '../ui/card';

// Predictive Grade-Loss Map — أين خسر الفوج درجات، ومطابقة جاهزيتك. رعب إيجابي يبيع نفسه.
export function GradeLossMap({ project, assignmentId }: { project: ProjectDNA; assignmentId?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const aid = assignmentId || (project as any).assignmentId || (project.aiPolicy?.assignmentId ?? '');

  useEffect(() => {
    if (!aid) { setLoading(false); return; }
    advancedApi.gradeLossMap(aid, project.id).then(setData).catch(e => setError(String(e?.message || e))).finally(() => setLoading(false));
  }, [aid, project.id]);

  if (loading) return <Card><CardContent><div className="h-40 grid place-items-center"><LoaderCircle className="animate-spin brand-text" /></div></CardContent></Card>;
  if (!aid || error || !data?.available) {
    return <Card><CardContent><div className="py-8 text-center"><div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center" style={{ background: '#f7dede' }}><Droplet style={{ color: 'var(--danger)' }} /></div><div className="text-sm font-semibold mt-3">خريطة الفقدان غير متاحة بعد</div><p className="body-copy mt-1 max-w-md mx-auto">{error || data?.headline || 'تحتاج بيانات فوج مصحّح كافية على هذا التكليف.'}</p></div></CardContent></Card>;
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg,#f7dede,transparent)' }}><Droplet size={20} style={{ color: 'var(--danger)' }} /></div>
          <div>
            <div className="eyebrow">تحليل {data.cohortSize} تسليمًا مصححًا · مجهول الهوية</div>
            <h2 className="section-title mt-0.5">خريطة فقدان الدرجات 🩸</h2>
          </div>
        </div>
        <div className="mt-4 rounded-2xl px-4 py-3 text-sm font-semibold leading-6" style={{ background: 'var(--accent-soft)', color: 'var(--ink)' }}>{data.headline}</div>

        <div className="mt-5 space-y-3">
          {data.criteria.filter((c: any) => c.severity !== 'insufficient').map((c: any) => (
            <div key={c.rubricId} className="rounded-2xl border hairline bg-[var(--bg)] p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <RiskDot risk={c.personalRisk} />
                  <h3 className="text-sm font-semibold truncate">{c.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {c.personalRisk === 'critical' && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: '#f7dede', color: 'var(--danger)' }}><AlertTriangle size={11} />خطر عليك</span>}
                  {c.personalRisk === 'ok' && <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: 'var(--brand-soft)', color: 'var(--brand-2)' }}><ShieldCheck size={11} />جاهز</span>}
                  <span className="text-lg font-bold" style={{ color: sevColor(c.severity) }}>{c.lossProbability}%</span>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'var(--panel-2)' }}>
                <div className="h-2 rounded-full" style={{ width: `${c.lossProbability}%`, background: sevColor(c.severity) }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] muted">
                <span>خسر نقاطًا هنا · متوسط الفاقد {c.averageLostPercent}% من المعيار</span>
                {c.commonReason && <span className="inline-flex items-center gap-1"><Eye size={11} />{c.commonReason}</span>}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] muted mt-4 leading-5">{data.privacyNote}</p>
      </CardContent>
    </Card>
  );
}

function sevColor(s: string) { return s === 'high' ? 'var(--danger)' : s === 'medium' ? 'var(--warning)' : 'var(--success)'; }
function RiskDot({ risk }: { risk: string }) {
  const c = risk === 'critical' ? 'var(--danger)' : risk === 'watch' ? 'var(--warning)' : risk === 'ok' ? 'var(--success)' : 'var(--muted)';
  return <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c, boxShadow: `0 0 0 3px color-mix(in srgb,${c} 20%,transparent)` }} />;
}
