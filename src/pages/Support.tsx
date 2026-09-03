import React, { useEffect, useState } from "react";
import {
  CircleHelp,
  LoaderCircle,
  MessageSquarePlus,
  ShieldAlert,
} from "lucide-react";
import { api } from "../lib/api";
import type { SupportTicket } from "../types";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { formatDate, useI18n } from "../lib/i18n";

export function Support() {
  const { t, locale } = useI18n();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    category: "technical",
    priority: "normal",
    subject: "",
    message: "",
  });
  function load() {
    setLoading(true);
    api
      .supportTickets()
      .then((r) => setTickets(r.tickets))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim()) return;
    setSaving(true);
    setError("");
    try {
      const r = await api.createSupportTicket(form as any);
      setTickets((v) => [r.ticket, ...v]);
      setForm({ ...form, subject: "", message: "" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("ui.supportSystem")}
        title={t("support.title")}
        description={t("support.description")}
      />
      {error && (
        <div className="rounded-xl border border-[var(--danger)]/20 p-3 text-sm text-danger">
          {error}
        </div>
      )}
      <div className="grid xl:grid-cols-[.8fr_1.2fr] gap-5">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <MessageSquarePlus size={18} className="brand-text" />
              <h2 className="section-title">{t("support.newTicket")}</h2>
            </div>
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={t("support.category")}>
                  <select
                    className="field"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                  >
                    <option value="technical">{t("support.catTechnical")}</option>
                    <option value="account">{t("support.catAccount")}</option>
                    <option value="academic">{t("support.catAcademic")}</option>
                    <option value="billing">{t("support.catBilling")}</option>
                    <option value="security">{t("support.catSecurity")}</option>
                    <option value="other">{t("support.catOther")}</option>
                  </select>
                </Field>
                <Field label={t("support.priority")}>
                  <select
                    className="field"
                    value={form.priority}
                    onChange={(e) =>
                      setForm({ ...form, priority: e.target.value })
                    }
                  >
                    <option value="normal">{t("support.prioNormal")}</option>
                    <option value="important">{t("support.prioImportant")}</option>
                    <option value="critical">{t("support.prioCritical")}</option>
                  </select>
                </Field>
              </div>
              <Field label={t("support.subject")}>
                <input
                  className="field"
                  maxLength={240}
                  value={form.subject}
                  onChange={(e) =>
                    setForm({ ...form, subject: e.target.value })
                  }
                  placeholder={t("support.subjectPh")}
                />
              </Field>
              <Field label={t("support.details")}>
                <textarea
                  className="field min-h-36 resize-y"
                  maxLength={8000}
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  placeholder={t("support.detailsPh")}
                />
              </Field>
              <div className="rounded-xl brand-soft-bg p-3 flex gap-2">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <p className="text-xs leading-6">
                  {t("support.securityNote")}
                </p>
              </div>
              <Button
                className="w-full"
                type="submit"
                disabled={
                  saving || !form.subject.trim() || !form.message.trim()
                }
              >
                {saving ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <CircleHelp size={16} />
                )}
                {t("support.submit")}
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">{t("ui.myTickets")}</div>
                <h2 className="section-title mt-1">{t("support.historyTitle")}</h2>
              </div>
              {loading ? (
                <LoaderCircle size={17} className="animate-spin brand-text" />
              ) : (
                <span className="text-[11px] muted">{tickets.length}</span>
              )}
            </div>
            <div className="mt-5 space-y-3">
              {tickets.length ? (
                tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-2xl border hairline p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] font-semibold ${ticket.status === "resolved" || ticket.status === "closed" ? "brand-soft-bg" : "soft-bg muted"}`}
                          >
                            {statusLabel(t, ticket.status)}
                          </span>
                          <span className="text-[9px] muted">
                            {categoryLabel(t, ticket.category)} ·{" "}
                            {priorityLabel(t, ticket.priority)}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold mt-2">
                          {ticket.subject}
                        </h3>
                      </div>
                      <time className="text-[9px] muted shrink-0">
                        {formatDate(ticket.updatedAt, locale)}
                      </time>
                    </div>
                    <p className="text-xs leading-6 muted mt-3 whitespace-pre-wrap">
                      {ticket.message}
                    </p>
                    <div className="text-[9px] muted mt-3 mono-number">
                      {t("ui.ticket")} {ticket.id.slice(0, 8)}
                    </div>
                  </div>
                ))
              ) : !loading ? (
                <div className="py-14 text-center">
                  <CircleHelp className="mx-auto muted" />
                  <h3 className="font-semibold mt-4">{t("support.noTickets")}</h3>
                  <p className="body-copy mt-2">
                    {t("support.noTicketsBody")}
                  </p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold muted">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
function statusLabel(t: (key: string) => string, v: SupportTicket["status"]) {
  return {
    open: t("support.statusOpen"),
    in_progress: t("support.statusInProgress"),
    resolved: t("support.statusResolved"),
    closed: t("support.statusClosed"),
  }[v];
}
function categoryLabel(
  t: (key: string) => string,
  v: SupportTicket["category"],
) {
  return {
    account: t("support.catLabelAccount"),
    academic: t("support.catLabelAcademic"),
    billing: t("support.catLabelBilling"),
    technical: t("support.catLabelTechnical"),
    security: t("support.catLabelSecurity"),
    other: t("support.catLabelOther"),
  }[v];
}
function priorityLabel(
  t: (key: string) => string,
  v: SupportTicket["priority"],
) {
  return {
    normal: t("support.prioNormal"),
    important: t("support.prioImportant"),
    critical: t("support.prioCritical"),
  }[v];
}
