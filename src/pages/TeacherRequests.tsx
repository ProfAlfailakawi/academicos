import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, GraduationCap, ShieldCheck, X, XCircle } from "lucide-react";
import { api } from "../lib/api";
import type { TeacherRequestRecord, TeacherRequestStatus } from "../types";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { DialogFrame } from "../components/AppDialog";
import { InlineLoader, AcademicLoader } from "../components/ui/AcademicLoader";
import { formatDateTime, useI18n } from "../lib/i18n";
import { localizedUiError } from "../lib/ui-error";

const TABS: TeacherRequestStatus[] = ["pending", "approved", "rejected"];

/** Platform-owner queue for teacher-account requests (approve / reject with reason). */
export function TeacherRequests() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<TeacherRequestStatus>("pending");
  const [items, setItems] = useState<TeacherRequestRecord[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deciding, setDeciding] = useState<{ item: TeacherRequestRecord; decision: "approve" | "reject" } | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setItems(null);
    setError("");
    api
      .adminTeacherRequests(status)
      .then((r) => setItems(r.requests))
      .catch((e) => {
        console.error("Failed to load teacher requests", e);
        setItems([]);
        setError(localizedUiError(e, t, "ui.loadError"));
      });
  }, [status, t]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [status]);

  function close() {
    if (saving) return;
    setDeciding(null);
    setReason("");
  }

  async function decide() {
    if (!deciding || saving) return;
    if (deciding.decision === "reject" && reason.trim().length < 3) return;
    setSaving(true);
    setError("");
    try {
      await api.decideTeacherRequest(deciding.item.id, { decision: deciding.decision, reason: reason.trim() || undefined });
      setItems((v) => (v || []).filter((x) => x.id !== deciding.item.id));
      setNotice(t("tr.decisionSaved"));
      setDeciding(null);
      setReason("");
    } catch (e: any) {
      setError(localizedUiError(e, t, "ui.loadError"));
    } finally {
      setSaving(false);
    }
  }

  const tabLabel = (s: TeacherRequestStatus) => (s === "pending" ? t("tr.tabPending") : s === "approved" ? t("tr.tabApproved") : t("tr.tabRejected"));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={t("layout.navTeacherRequests")} title={t("tr.adminTitle")} description={t("tr.adminDesc")} />
      <div role="tablist" aria-label={t("tr.adminTitle")} className="flex flex-wrap gap-2">
        {TABS.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={status === s}
            onClick={() => { setStatus(s); setNotice(""); }}
            className={`focus-ring min-h-11 rounded-xl border px-4 text-sm font-semibold ${status === s ? "brand-soft-bg border-[var(--brand)] brand-text" : "hairline muted"}`}
          >
            {tabLabel(s)}
          </button>
        ))}
      </div>
      {notice && <div role="status" className="rounded-xl border border-[var(--success)]/20 p-3 text-sm text-success">{notice}</div>}
      {error && <div role="alert" className="rounded-xl border border-[var(--danger)]/20 p-3 text-sm text-danger">{error}</div>}
      {items === null ? (
        <div className="min-h-56 grid place-items-center"><AcademicLoader size={40} label={t("app.loading")} /></div>
      ) : items.length === 0 ? (
        <Card><CardContent><p className="body-copy">{t("tr.empty")}</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-start gap-4 justify-between">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <GraduationCap size={16} className="brand-text shrink-0" />
                      <h2 dir="auto" className="section-title break-words">{item.displayName || item.email}</h2>
                    </div>
                    <div dir="ltr" className="text-meta muted break-all text-start">{item.email}</div>
                    <div dir="auto" className="text-sm break-words">{t("tr.institution")}: <strong>{item.institution}</strong></div>
                    {item.note && <p dir="auto" className="text-xs leading-6 muted break-words">{item.note}</p>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-meta muted">
                      <span className={item.emailVerified ? "text-success" : "text-warning"}>
                        {item.emailVerified ? t("tr.emailVerified") : t("tr.emailUnverified")}
                      </span>
                      <span>{formatDateTime(item.updatedAt, locale)}</span>
                      {item.attempts > 1 && <span>#{item.attempts}</span>}
                    </div>
                    {item.status !== "pending" && (
                      <div className="text-xs muted">
                        {item.reason && <div>{t("tr.reason")}: {item.reason}</div>}
                        {item.decidedBy && <div dir="ltr" className="text-start">{t("tr.decidedBy")}: {item.decidedBy}</div>}
                      </div>
                    )}
                  </div>
                  {item.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <Button onClick={() => { setDeciding({ item, decision: "approve" }); setReason(""); }}>
                        <CheckCircle2 size={15} />{t("tr.approve")}
                      </Button>
                      <Button variant="outline" onClick={() => { setDeciding({ item, decision: "reject" }); setReason(""); }}>
                        <XCircle size={15} />{t("tr.reject")}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {deciding && (
        <DialogFrame
          onClose={close}
          busy={saving}
          labelledBy="teacher-decision-title"
          overlayClassName="fixed inset-0 z-[90] grid place-items-center p-4"
          backdropClassName="absolute inset-0 bg-black/30 backdrop-blur-sm"
          className="relative panel rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={17} className="brand-text" />
                <h2 id="teacher-decision-title" className="section-title">
                  {deciding.decision === "approve" ? t("tr.confirmApprove") : t("tr.confirmReject")}
                </h2>
              </div>
              <p dir="auto" className="body-copy mt-2">{deciding.item.displayName || deciding.item.email} — {deciding.item.institution}</p>
            </div>
            <Button size="icon" variant="ghost" aria-label={t("tr.close")} onClick={close}><X size={17} /></Button>
          </div>
          <label className="block mt-5">
            <span className="text-[11px] font-semibold muted">
              {deciding.decision === "approve" ? t("tr.reasonOptional") : t("tr.reasonRequired")}
            </span>
            <textarea maxLength={1000} className="field mt-1.5 min-h-24 resize-y" value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <Button
            className="w-full mt-4"
            disabled={saving || (deciding.decision === "reject" && reason.trim().length < 3)}
            onClick={decide}
          >
            {saving ? <InlineLoader size={15} /> : <ShieldCheck size={15} />}
            {deciding.decision === "approve" ? t("tr.approve") : t("tr.reject")}
          </Button>
        </DialogFrame>
      )}
    </div>
  );
}
