import React from 'react';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="page-header flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="page-header__copy max-w-3xl">
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="body-copy mt-3 max-w-2xl">{description}</p>}
      </div>
      {action && <div className="page-header__action shrink-0">{action}</div>}
    </header>
  );
}
