/**
 * «نُحدّث البرنامج» داخل التطبيق.
 *
 * أثناء النشر تجيب واجهةُ Google الأمامية طلباتِ /api بصفحة HTML إنجليزية
 * (500/502/503/504) لا يكتبها خادمُنا — هو يجيب /api بـJSON دائمًا. كانت الشاشات
 * تعرضها «الخدمة غير متاحة»، وكان تعافي الحزم يظنّها نسخةً قديمة فيمسح الذاكرة
 * ويُسقط العامل في اللحظة التي يلزم فيها.
 *
 * هنا يُعرف ذلك الجواب، ويظهر شريطٌ هادئ واحد بدل لافتة الخطأ، ويسأل
 * /api/health/live كل ثلاث ثوانٍ حتى يعود الخادم فيختفي ويُعلم من ينتظر.
 */

const UPDATING_STATUSES = new Set([500, 502, 503, 504]);

/** رمز ApiError حين يكون الجواب من المنصّة لا من البرنامج. */
export const PLATFORM_UPDATING_CODE = "PLATFORM_UPDATING";
export const HEALTH_LIVE_URL = "/api/health/live";
/** يُطلق على window حين يعود الخادم. */
export const SERVER_BACK_EVENT = "academicos:server-back";

/** الشريط يظهر خارج React، فنصّه هنا: العربية، وإلا فالإنجليزية لبقية اللغات. */
const MESSAGES = {
  ar: "نُحدّث البرنامج الآن ✨ لحظاتٍ ونعود.",
  en: "We're updating AcademicOS ✨ Back in a moment.",
};
export const UPDATING_MESSAGE = MESSAGES.ar;

export function updatingMessage(): string {
  try {
    const lang = (document.documentElement.getAttribute("lang") || "ar").slice(0, 2);
    return lang === "ar" ? MESSAGES.ar : MESSAGES.en;
  } catch {
    return MESSAGES.ar;
  }
}

/** جوابُ المنصّة لا جوابُ البرنامج: 5xx بغير JSON. */
export const isPlatformUpdating = (status: number, contentType: string | null | undefined) =>
  UPDATING_STATUSES.has(status) && !String(contentType || "").includes("application/json");

/** هل يجيب الخادم أصلًا؟ */
export const serverAnswers = (): Promise<boolean> =>
  fetch(HEALTH_LIVE_URL, { cache: "no-store", credentials: "same-origin" }).then(
    (response) => response.ok,
    () => false,
  );

let notice: HTMLElement | null = null;
const waiting = new Set<() => void>();

/**
 * يُظهر الشريطَ مرّةً واحدة مهما تكرّر الطلب، ويسأل `probe` كل ثلاث ثوانٍ
 * (ويتباطأ إلى خمس عشرة)، فإذا أجاب أخفاه ونادى `onBack` ومن سبقه.
 */
export function showUpdatingNotice(probe: () => Promise<boolean> = serverAnswers, onBack?: () => void): void {
  if (onBack) waiting.add(onBack);
  if (notice || typeof document === "undefined" || !document.body) return;
  const bar = document.createElement("div");
  bar.className = "academicos-updating-notice";
  bar.setAttribute("role", "status");
  bar.setAttribute("aria-live", "polite");
  bar.dir = "auto";
  bar.textContent = updatingMessage();
  bar.style.cssText = [
    "position:fixed", "inset-inline:0", "bottom:max(18px,env(safe-area-inset-bottom))", "margin:0 auto", "width:max-content", "max-width:calc(100vw - 32px)",
    "z-index:2147483000", "padding:11px 18px", "border-radius:14px", "font-family:inherit", "font-size:14px", "font-weight:600", "line-height:1.6",
    "background:var(--panel,#fcfdff)", "color:var(--ink,#131a33)", "border:1px solid var(--line,#d3dae8)",
    "box-shadow:0 14px 36px rgb(23 35 77 / .18)", "text-align:center", "pointer-events:none",
  ].join(";");
  document.body.appendChild(bar);
  notice = bar;
  let tries = 0;
  const ask = async () => {
    const back = await probe().catch(() => false);
    if (!back) {
      tries++;
      window.setTimeout(ask, Math.min(15_000, 3000 * Math.pow(1.3, Math.max(0, tries - 5))));
      return;
    }
    bar.remove();
    notice = null;
    const callbacks = [...waiting];
    waiting.clear();
    callbacks.forEach((callback) => { try { callback(); } catch { /* one waiter must not stop the others */ } });
    window.dispatchEvent(new Event(SERVER_BACK_EVENT));
  };
  window.setTimeout(ask, 3000);
}
