import React from 'react';
import { cn } from '../lib/utils';
import { useI18n } from '../lib/i18n';
import { runtimeEnumLabel } from '../lib/platform-locale';

const map: Record<string, { className: string }> = {
  not_started: { className: 'bg-[var(--panel-2)] muted' },
  ready: { className: 'brand-soft-bg' },
  in_progress: { className: 'bg-[#e8eff6] text-[#315d80] dark:bg-[#21303b] dark:text-[#9bc1dc]' },
  blocked: { className: 'bg-[#f5e6e3] text-[var(--danger)] dark:bg-[#382522]' },
  needs_review: { className: 'bg-[#f7eddd] text-[var(--warning)] dark:bg-[#332a1d]' },
  completed: { className: 'bg-[#e5efe5] text-[#35633d] dark:bg-[#203326] dark:text-[#9ac5a2]' },
  pending: { className: 'bg-[var(--panel-2)] muted' },
  covered: { className: 'bg-[#e5efe5] text-[#35633d] dark:bg-[#203326] dark:text-[#9ac5a2]' },
  partial: { className: 'bg-[#f7eddd] text-[var(--warning)] dark:bg-[#332a1d]' },
  not_evidenced: { className: 'bg-[#f5e6e3] text-[var(--danger)] dark:bg-[#382522]' },
  needs_revision: { className: 'bg-[#f7eddd] text-[var(--warning)] dark:bg-[#332a1d]' },
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const { t, locale } = useI18n();
  const item = map[status];
  const keyed = item ? t(`pill.${status}`) : '';
  const resolvedLabel = label || (keyed && keyed !== `pill.${status}` ? keyed : runtimeEnumLabel(status, locale));
  const className = item ? item.className : 'bg-[var(--panel-2)] muted';
  return <span className={cn('status-pill inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap', className)}>{resolvedLabel}</span>;
}
