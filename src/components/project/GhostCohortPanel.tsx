import React, { useEffect, useState } from 'react';
import { Ghost, LoaderCircle, TrendingUp, Timer, RefreshCw, BookMarked, Sparkles } from 'lucide-react';
import { advancedApi } from '../../lib/api';
import type { ProjectDNA } from '../../types';
import { Card, CardContent } from '../ui/card';

// Ghost Cohort — إيقاع المتفوقين المجهول (k-anonymity) مقابل تقدّم الطالب الحالي.
// جمال بصري: مسار زمني أفقي بمناطق p25..p75، ودبوس «أنت الآن»، وبطاقات حِكم مقتضبة.
export function GhostCohortPanel({ project, assignmentId }: { project: ProjectDNA; assignmentId?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const aid = assignmentId || (project as any).assignmentId || (project.aiPolicy?.assignmentId ?? '');

  useEffect(() => {
    if (!aid) { setLoading(false); return; }
    advancedApi.ghostCohort(aid, project.id).then(setData).catch(e => setError(String(e?.message || e))).finally(() => setLoading(false));
  }, [aid, project.id]);

  if (loading) return <Card><CardContent><div className="h-40 grid place-items-center"><LoaderCircle className="animate-spin brand-text" /></div></CardContent></Card>;
  if (!aid || error || !data) return <Card><CardContent><EmptyGhost reason={error || 'لا يوجد تكليف مرتبط بعد.'} /></CardContent></Card>;
  if (!data.available) return <Card><CardContent><EmptyGhost reason={`يظهر الفوج الشبح بعد اكتمال ${data.kAnonymityMin} متفوقين على هذا التكليف — حمايةً لخصوصية الأفراد.`} /></CardContent></Card>;

  const live = data.live;
  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl grid place-items-center shrink-0" style={{ background: 'linear-gradient(135deg,var(--brand-soft),transparent)' }}>
              <Ghost size={20} className="brand-text" />
            </div>
            <div>
              <div className="eyebrow">إيقاع مجهول الهوية · {data.cohortSize} متفوق</div>
              <h2 className="section-title mt-0.5">الفوج الشبح 👻</h2>
            </div>
          </div>
          {live && <PaceBadge pace={live.pace} />}
        </div>
        <p className="body-copy mt-3">هكذا كان إيقاع من حصلوا على تقدير مرتفع في هذا التكليف — <b>عمليتهم لا محتواهم</b>. الخط أدناه هو رحلتهم الزمنية النموذجية، والدبوس هو موضعك الآن.</p>

        {/* المسار الزمني */}
        <div className="mt-6 rounded-2xl border hairline bg-[var(--bg)] p-5">
          <div className="relative">
            {live && (
              <div className="absolute -top-2 z-10 -translate-x-1/2 flex flex-col items-center" style={{ insetInlineStart: `${live.progress}%` }}>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-bold text-white shadow" style={{ background: 'var(--brand-2)' }}>أنت · {live.progress}%</span>
                <span className="h-3 w-0.5" style={{ background: 'var(--brand-2)' }} />
              </div>
            )}
            <div className="h-2.5 rounded-full mt-4" style={{ background: 'linear-gradient(90deg,#deeee7,#a8d5c2,#0c5d49)' }} />
            <div className="mt-4 space-y-2.5">
              {data.phases.map((ph: any) => (
                <div key={ph.phase} className="grid grid-cols-[110px_1fr] items-center gap-3">
                  <div className="text-[11px] font-semibold truncate">{ph.label}</div>
                  <div className="relative h-6 rounded-lg" style={{ background: 'var(--panel-2)' }}>
                    <div className="absolute top-0 h-6 rounded-lg opacity-80" style={{ insetInlineStart: `${ph.typicalAtP25}%`, width: `${Math.max(3, ph.typicalAtP75 - ph.typicalAtP25)}%`, background: 'color-mix(in srgb,var(--brand) 30%,transparent)' }} title={`النطاق المعتاد ${ph.typicalAtP25}%–${ph.typicalAtP75}%`} />
                    <div className="absolute top-0 h-6 w-0.5" style={{ insetInlineStart: `${ph.typicalAtP50}%`, background: 'var(--brand)' }} title={`الوسيط ${ph.typicalAtP50}%`} />
                    <span className="absolute inset-y-0 grid place-items-center text-[9px] muted" style={{ insetInlineStart: `${Math.min(88, ph.typicalAtP50 + 2)}%` }}>{ph.typicalAtP50}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* المقاييس */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Metric icon={<RefreshCw size={15} />} label="مراجعات نموذجية" value={data.benchmarks.medianRevisions} />
          <Metric icon={<BookMarked size={15} />} label="تحقّق مصادر" value={data.benchmarks.medianSourceReviews} />
          <Metric icon={<Timer size={15} />} label="أيام عمل" value={data.benchmarks.medianActiveDays} />
        </div>

        {live?.nudges?.length ? (
          <div className="mt-4 space-y-2">
            {live.nudges.map((n: string, i: number) => (
              <div key={i} className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs leading-6" style={{ background: 'var(--accent-soft)' }}>
                <Sparkles size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} /> <span>{n}</span>
              </div>
            ))}
          </div>
        ) : null}
        <p className="text-[10px] muted mt-4 leading-5">{data.privacyNote}</p>
      </CardContent>
    </Card>
  );
}

function PaceBadge({ pace }: { pace: string }) {
  const map: Record<string, { t: string; bg: string; c: string }> = {
    ahead: { t: 'متقدّم على الإيقاع', bg: 'var(--brand-soft)', c: 'var(--brand-2)' },
    on_track: { t: 'على المسار', bg: 'var(--accent-soft)', c: 'var(--accent)' },
    behind: { t: 'خلف الإيقاع', bg: '#f7dede', c: 'var(--danger)' },
  };
  const s = map[pace] || map.on_track;
  return <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: s.bg, color: s.c }}><TrendingUp size={13} />{s.t}</span>;
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border hairline bg-[var(--panel)] p-3 text-center">
      <div className="grid place-items-center brand-text">{icon}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      <div className="text-[10px] muted mt-0.5">{label}</div>
    </div>
  );
}
function EmptyGhost({ reason }: { reason: string }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center" style={{ background: 'var(--brand-soft)' }}><Ghost className="brand-text" /></div>
      <div className="text-sm font-semibold mt-3">الفوج الشبح غير متاح بعد</div>
      <p className="body-copy mt-1 max-w-md mx-auto">{reason}</p>
    </div>
  );
}
