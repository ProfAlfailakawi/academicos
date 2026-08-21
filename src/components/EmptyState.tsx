import React from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state panel rounded-2xl p-8 sm:p-10 text-center">{Icon && <div className="empty-state__icon mx-auto h-11 w-11 rounded-xl brand-soft-bg grid place-items-center"><Icon size={19} /></div>}<h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="body-copy mx-auto mt-2 max-w-lg">{description}</p>{action && <div className="mt-5 flex justify-center">{action}</div>}</div>;
}
