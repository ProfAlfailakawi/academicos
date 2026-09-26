import React, { useEffect } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { useOfflineQueue } from "../lib/offline-sync";

/** Connectivity banner: offline notice, queued-edit count and sync result. */
export function OfflineBanner() {
  const { t, formatNumber } = useI18n();
  const { online, pending, flush, lastSync, clearLastSync } = useOfflineQueue();

  useEffect(() => {
    if (!lastSync) return;
    const timer = window.setTimeout(clearLastSync, 6000);
    return () => window.clearTimeout(timer);
  }, [lastSync, clearLastSync]);

  if (online && !pending && !lastSync) return null;
  return (
    <div role="status" aria-live="polite" className={`mb-4 rounded-xl border px-4 py-3 text-sm flex flex-wrap items-center justify-between gap-2 ${online ? "brand-soft-bg border-[var(--brand)]/20" : "bg-warning/10 text-warning border-warning/25"}`}>
      <div className="flex items-center gap-2">
        {online ? <RefreshCw size={16} /> : <CloudOff size={16} />}
        <span>
          {!online
            ? t("offline.banner")
            : pending
              ? t("offline.pending").replace("{n}", formatNumber(pending))
              : lastSync?.dropped
                ? t("offline.syncedWithDrops").replace("{n}", formatNumber(lastSync.sent)).replace("{d}", formatNumber(lastSync.dropped))
                : t("offline.synced").replace("{n}", formatNumber(lastSync?.sent || 0))}
        </span>
        {!online && pending > 0 && <span className="font-semibold">· {t("offline.pending").replace("{n}", formatNumber(pending))}</span>}
      </div>
      {online && pending > 0 && (
        <button type="button" onClick={() => void flush()} className="focus-ring rounded-lg px-3 py-1.5 text-xs font-semibold border hairline bg-[var(--panel)]">
          {t("offline.syncNow")}
        </button>
      )}
    </div>
  );
}
