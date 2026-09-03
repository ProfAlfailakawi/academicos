import React from 'react';
import { cn } from '../lib/utils';
import { useI18n } from '../lib/i18n';
import { runtimeEnumLabel } from '../lib/platform-locale';

// الحالة تُعلن معناها فقط؛ اللون يأتي من التوكنز فيصحّ في السمتين.
const TONE: Record<string, string> = {
  not_started: 'muted',
  pending: 'muted',
  ready: 'brand',
  in_progress: 'info',
  blocked: 'danger',
  not_evidenced: 'danger',
  needs_review: 'warning',
  partial: 'warning',
  needs_revision: 'warning',
  completed: 'success',
  covered: 'success',
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const { t, locale } = useI18n();
  const tone = TONE[status];
  const keyed = tone ? t(`pill.${status}`) : '';
  const resolvedLabel = label || (keyed && keyed !== `pill.${status}` ? keyed : runtimeEnumLabel(status, locale));
  return (
    <span className={cn('status-pill tone-chip')} data-tone={tone || 'muted'}>
      {resolvedLabel}
    </span>
  );
}
