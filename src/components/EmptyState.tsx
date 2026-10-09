import React from 'react';
import type { LucideIcon } from 'lucide-react';

export type EmptyScene = 'projects' | 'notifications' | 'skills';

/** Small calm line-art scenes (brand tokens only, decorative). */
function Scene({ kind }: { kind: EmptyScene }) {
  const common = { width: 132, height: 96, viewBox: '0 0 132 96', 'aria-hidden': true, className: 'empty-scene', fill: 'none' } as const;
  if (kind === 'projects') {
    return (
      <svg {...common}>
        <ellipse cx="66" cy="86" rx="46" ry="5" className="es-ground" />
        <rect x="26" y="26" width="54" height="52" rx="8" className="es-paper es-back" transform="rotate(-6 53 52)" />
        <rect x="40" y="16" width="56" height="62" rx="8" className="es-paper" />
        <path d="M52 34h32M52 44h32M52 54h20" className="es-line" />
        <circle cx="94" cy="64" r="15" className="es-accent" />
        <path d="M94 57v14M87 64h14" className="es-plus" />
      </svg>
    );
  }
  if (kind === 'notifications') {
    return (
      <svg {...common}>
        <ellipse cx="66" cy="86" rx="40" ry="5" className="es-ground" />
        <path d="M66 14c-15 0-24 11-24 26v16l-8 12h64l-8-12V40c0-15-9-26-24-26Z" className="es-paper" />
        <path d="M58 72a8 8 0 0 0 16 0" className="es-line" />
        <circle cx="66" cy="11" r="3.5" className="es-accent" />
        <path d="M24 34c-5 5-7 11-7 17M108 34c5 5 7 11 7 17" className="es-line es-faint" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <ellipse cx="66" cy="86" rx="46" ry="5" className="es-ground" />
      <path d="M66 12 100 36 87 76H45L32 36Z" className="es-paper" />
      <path d="M66 28 86 42 78 66H54L46 42Z" className="es-line es-faint" />
      <path d="M66 12v16M100 36 86 42M87 76l-9-10M45 76l9-10M32 36l14 6" className="es-line es-faint" />
      <circle cx="66" cy="48" r="6" className="es-accent" />
    </svg>
  );
}

export function EmptyState({ icon: Icon, title, description, action, scene }: { icon?: LucideIcon; title: string; description: string; action?: React.ReactNode; scene?: EmptyScene }) {
  return <div className="empty-state panel rounded-2xl p-8 sm:p-10 text-center">{scene ? <Scene kind={scene} /> : Icon && <div className="empty-state__icon mx-auto h-11 w-11 rounded-xl tone-tile"><Icon size={19} /></div>}<h3 className="mt-4 text-sm font-semibold">{title}</h3><p className="body-copy mx-auto mt-2 max-w-lg">{description}</p>{action && <div className="mt-5 flex justify-center">{action}</div>}</div>;
}
