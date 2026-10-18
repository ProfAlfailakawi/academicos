import React, { useEffect, useState } from "react";
import { GraduationCap, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../lib/i18n";
import { localizedUiError } from "../lib/ui-error";
import type { TeacherRequestRecord } from "../types";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { InlineLoader } from "./ui/AcademicLoader";

/**
 * Settings card for asking the platform team for a teacher account. The role
 * itself is only ever granted server-side after an owner approves the request.
 */
export function TeacherAccountCard({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  const { user, refreshUser } = useAuth();
  const [request, setRequest] = useState<TeacherRequestRecord | null | undefined>(undefined);
  const [institution, setInstitution] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isStudent = user?.role === "student" || user?.role === "student_group_leader";

  useEffect(() => {
    let cancelled = false;
    api
      .myTeacherRequest()
      .then((r) => {
        if (cancelled) return;
        setRequest(r.request);
        if (r.request) {
          setInstitution(r.request.institution);
          setNote(r.request.note || "");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setRequest(null);
          setError(localizedUiError(e, t, "tr.loadError"));
        }
      });
    try {
      if (window.sessionStorage.getItem("academicos.teacherRequestFailed")) {
        window.sessionStorage.removeItem("academicos.teacherRequestFailed");
        setError(t("login.teacherRequestFailed"));
      }
    } catch { /* storage unavailable */ }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Approved on the server but this session still carries the old claims: pick up the new role.
  const needsRefresh = request?.status === "approved" && isStudent;
  if (!isStudent && request?.status !== "approved") return null;
  if (request === undefined) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await api.submitTeacherRequest({ institution, note: note || undefined });
      setRequest(r.request);
      setMessage(t("tr.sent"));
    } catch (e: any) {
      setError(localizedUiError(e, t, "tr.loadError"));
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      await refreshUser();
    } catch (e: any) {
      setError(localizedUiError(e, t, "tr.loadError"));
    } finally {
      setBusy(false);
    }
  }

  const canEdit = isStudent && request?.status !== "approved";
  return (
    <Card className={className}>
      <CardContent>
        <div className="flex items-center gap-2">
          <GraduationCap size={17} className="brand-text" />
          <h2 className="section-title">{t("tr.title")}</h2>
        </div>
        <p className="body-copy mt-3">{t("tr.desc")}</p>
        {request && (
          <div role="status" className="mt-4 rounded-xl border hairline p-3 text-xs leading-6">
            <strong>
              {request.status === "pending" ? t("tr.statusPending") : request.status === "approved" ? t("tr.statusApproved") : t("tr.statusRejected")}
            </strong>
            {request.status === "rejected" && request.reason && (
              <div className="mt-1 muted">{t("tr.reason")}: {request.reason}</div>
            )}
          </div>
        )}
        {needsRefresh && (
          <Button className="mt-3" onClick={refresh} disabled={busy}>
            {busy ? <InlineLoader size={15} /> : <RefreshCw size={15} />}
            {t("tr.refresh")}
          </Button>
        )}
        {canEdit && (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs font-semibold">{t("tr.institution")}</span>
              <input required minLength={2} maxLength={160} value={institution} onChange={(e) => setInstitution(e.target.value)} className="field mt-1.5" placeholder={t("login.institutionPlaceholder")} />
            </label>
            <label className="block">
              <span className="text-xs font-semibold">{t("tr.note")}</span>
              <textarea maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} className="field mt-1.5 min-h-20 resize-y" />
            </label>
            <Button disabled={busy || institution.trim().length < 2}>
              {busy && <InlineLoader size={15} />}
              {request?.status === "rejected" ? t("tr.resubmit") : request?.status === "pending" ? t("tr.update") : t("tr.submit")}
            </Button>
          </form>
        )}
        {message && <p role="status" className="text-xs mt-3 text-success">{message}</p>}
        {error && <p role="alert" className="text-xs mt-3 text-danger">{error}</p>}
      </CardContent>
    </Card>
  );
}
