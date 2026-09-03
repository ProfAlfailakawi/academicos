import React, { useEffect, useState } from 'react';
import { Ghost, LoaderCircle, TrendingUp, Timer, RefreshCw, BookMarked, Sparkles } from 'lucide-react';
import { advancedApi } from '../../lib/api';
import type { ProjectDNA } from '../../types';
import { Card, CardContent } from '../ui/card';
import { useI18n } from '../../lib/i18n';

// Ghost Cohort — anonymized rhythm of high scorers (k-anonymity) vs. the current student's progress.
export function GhostCohortPanel({ project, assignmentId }: { project: ProjectDNA; assignmentId?: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const aid = assignmentId || (project as any).assignmentId || (project.aiPolicy?.assignmentId ?? '');

  useEffect(() => {
    if (!aid) { setLoading(false); return; }
    advancedApi.ghostCohort(aid, project.id).then(setData).catch(e => setError(String(e?.message || e))).finally(() => setLoading(false));
  }, [aid, project.id]);

  if (loading) return <Card><CardContent><div className="h-40 grid place-items-center"><LoaderCircle className="animate-spin brand-text" /></div></CardContent></Card>;
  if (!aid || error || !data) return <Card><CardContent><EmptyGhost t={t} reason={error || t('adv.ghost.noAssignment')} /></CardContent></Card>;
  if (!data.available) return <Card><CardContent><EmptyGhost t={t} reason={t('adv.ghost.needK').replace('{k}', String(data.kAnonymityMin))} /></CardContent></Card>;

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
              <div className="eyebrow">{t('adv.ghost.anonRhythm').replace('{n}', String(data.cohortSize))}</div>
              <h2 className="section-title mt-0.5">{t('adv.ghost.title')}</h2>
            </div>
          </div>
          {live && <PaceBadge t={t} pace={live.pace} />}
        </div>
        <p className="body-copy mt-3">{t('adv.ghost.intro')}</p>

        {/* timeline */}
        <div className="mt-6 rounded-2xl border hairline bg-[var(--bg)] p-5">
          <div className="relative">
            {live && (
              <div className="absolute -top-2 z-10 -translate-x-1/2 flex flex-col items-center" style={{ insetInlineStart: `${live.progress}%` }}>
                <span className="rounded-full px-2 py-0.5 text-[9px] font-bold text-white shadow" style={{ background: 'var(--brand-2)' }}>{t('adv.ghost.you').replace('{p}', String(live.progress))}</span>
                <span className="h-3 w-0.5" style={{ background: 'var(--brand-2)' }} />
              </div>
            )}
            <div className="h-2.5 rounded-full mt-4" style={{ background: 'linear-gradient(90deg, var(--brand-soft), color-mix(in srgb, var(--brand) 45%, var(--brand-soft)), var(--brand))' }} />
            <div className="mt-4 space-y-2.5">
              {data.phases.map((ph: any) => (
                <div key={ph.phase} className="grid grid-cols-[110px_1fr] items-center gap-3">
                  <div className="text-[11px] font-semibold truncate">{ph.label}</div>
                  <div className="relative h-6 rounded-lg" style={{ background: 'var(--panel-2)' }}>
                    <div className="absolute top-0 h-6 rounded-lg opacity-80" style={{ insetInlineStart: `${ph.typicalAtP25}%`, width: `${Math.max(3, ph.typicalAtP75 - ph.typicalAtP25)}%`, background: 'color-mix(in srgb,var(--brand) 30%,transparent)' }} title={t('adv.ghost.tipRange').replace('{a}', String(ph.typicalAtP25)).replace('{b}', String(ph.typicalAtP75))} />
                    <div className="absolute top-0 h-6 w-0.5" style={{ insetInlineStart: `${ph.typicalAtP50}%`, background: 'var(--brand)' }} title={t('adv.ghost.tipMedian').replace('{p}', String(ph.typicalAtP50))} />
                    <span className="absolute inset-y-0 grid place-items-center text-[9px] muted" style={{ insetInlineStart: `${Math.min(88, ph.typicalAtP50 + 2)}%` }}>{ph.typicalAtP50}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* metrics */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Metric icon={<RefreshCw size={15} />} label={t('adv.ghost.metricRevisions')} value={data.benchmarks.medianRevisions} />
          <Metric icon={<BookMarked size={15} />} label={t('adv.ghost.metricSources')} value={data.benchmarks.medianSourceReviews} />
          <Metric icon={<Timer size={15} />} label={t('adv.ghost.metricDays')} value={data.benchmarks.medianActiveDays} />
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

function PaceBadge({ pace, t }: { pace: string; t: (k: string) => string }) {
  const map: Record<string, { key: string; bg: string; c: string }> = {
    ahead: { key: 'adv.pace.ahead', bg: 'var(--brand-soft)', c: 'var(--brand-2)' },
    on_track: { key: 'adv.pace.onTrack', bg: 'var(--accent-soft)', c: 'var(--accent)' },
    behind: { key: 'adv.pace.behind', bg: 'color-mix(in srgb, var(--danger) 12%, transparent)', c: 'var(--danger)' },
  };
  const s = map[pace] || map.on_track;
  return <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold" style={{ background: s.bg, color: s.c }}><TrendingUp size={13} />{t(s.key)}</span>;
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
function EmptyGhost({ reason, t }: { reason: string; t: (k: string) => string }) {
  return (
    <div className="py-8 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl grid place-items-center" style={{ background: 'var(--brand-soft)' }}><Ghost className="brand-text" /></div>
      <div className="text-sm font-semibold mt-3">{t('adv.ghost.unavailable')}</div>
      <p className="body-copy mt-1 max-w-md mx-auto">{reason}</p>
    </div>
  );
}
