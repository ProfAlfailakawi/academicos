/* ?duo-debug=1 : hidden diagnostics for the Duo system-widget keep-out.
   Loaded only when the parameter is present (see main.tsx). Draws the reserved box
   (translucent red frame, pointer-events none) and a small panel with the numbers
   that decide it. The panel sits at the bottom-left, outside the box. Read-only. */
function probe(name: string, side: 'width' | 'height'): number {
  const t = document.createElement('div');
  t.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;${side}:var(${name}, 0px)`;
  document.body.appendChild(t);
  const v = t.getBoundingClientRect()[side];
  t.remove();
  return v;
}
function env(side: string): string {
  const t = document.createElement('div');
  t.style.cssText = `position:fixed;visibility:hidden;padding-${side}:env(safe-area-inset-${side}, 0px)`;
  document.body.appendChild(t);
  const v = getComputedStyle(t).getPropertyValue(`padding-${side}`);
  t.remove();
  return v || '0px';
}

export function mountDuoDebug(): void {
  if (document.querySelector('[data-duo-debug]')) return;
  // Live calibration on the real device: ?duo-debug=1&duo-w=110&duo-h=270 overrides the two tokens (this page only).
  const q = new URLSearchParams(location.search);
  const ow = Number(q.get('duo-w')), oh = Number(q.get('duo-h'));
  if (ow > 0) document.documentElement.style.setProperty('--duo-widget-w', `${ow}px`);
  if (oh > 0) document.documentElement.style.setProperty('--duo-widget-h', `${oh}px`);
  const frame = document.createElement('div');
  frame.setAttribute('data-duo-debug', 'frame');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;top:0;right:0;z-index:2147483646;pointer-events:none;box-sizing:border-box;' +
    'width:var(--duo-widget-w,0px);height:var(--duo-widget-h,0px);border:2px solid rgba(255,0,0,.85);background:rgba(255,0,0,.12)';
  const panel = document.createElement('pre');
  panel.setAttribute('data-duo-debug', 'panel');
  panel.dir = 'ltr';
  panel.style.cssText = 'position:fixed;left:6px;bottom:6px;z-index:2147483646;pointer-events:none;margin:0;max-width:calc(100vw - 90px);' +
    'padding:6px 8px;border-radius:8px;background:rgba(0,0,0,.78);color:#fff;font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap';
  document.body.append(frame, panel);

  const update = () => {
    const vv = window.visualViewport;
    const w = probe('--duo-widget-w', 'width');
    const h = probe('--duo-widget-h', 'height');
    const gap = probe('--duo-widget-gap', 'width');
    const nav = navigator as Navigator & { standalone?: boolean };
    panel.textContent = [
      `zone active: ${w > 0 && h > 0 ? 'YES' : 'no'}${ow > 0 || oh > 0 ? '  (CALIBRATING: duo-w/duo-h override)' : ''}`,
      `--duo-widget-w ${w}px  gap ${gap}px  h ${Math.round(h)}px`,
      `safe-area t/r/b/l: ${env('top')} / ${env('right')} / ${env('bottom')} / ${env('left')}`,
      `inner ${innerWidth}x${innerHeight}  client ${document.documentElement.clientWidth}`,
      `visualViewport ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} @${vv.scale.toFixed(2)}` : 'n/a'}`,
      `dir ${document.documentElement.dir || getComputedStyle(document.documentElement).direction}  ${innerWidth > innerHeight ? 'landscape' : 'portrait'}`,
      `standalone ${nav.standalone === true || matchMedia('(display-mode: standalone)').matches}`,
      `Capacitor: ${(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor?.isNativePlatform?.() ? `native ${(window as unknown as { Capacitor: { getPlatform?: () => string } }).Capacitor.getPlatform?.() ?? ''}` : 'no (browser)'}`,
      `UA: ${/Safari\//.test(navigator.userAgent) ? 'Safari token' : 'no Safari token (WKWebView/app)'}  ${/iPhone|iPad/.test(navigator.userAgent) ? 'iOS' : 'non-iOS'}`,
      'send a screenshot with the frame; change duo-w / duo-h until the red frame covers the capsule',
    ].join('\n');
  };
  update();
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
}
