import React, { useEffect, useState } from "react";
import {
  Clock3,
  CreditCard,
  Download,
  Eye,
  KeyRound,
  Languages,
  Server,
  ShieldCheck,
  Sun,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link, useLocation } from "react-router";
import { api } from "../lib/api";
import { useAppPreferences } from "../contexts/AppContext";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useI18n } from "../lib/i18n";

export function Settings() {
  const location = useLocation();
  const { t } = useI18n();
  const { theme, setTheme, accessibility, setAccessibility } =
    useAppPreferences();
  const [h, setH] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [deletionMessage, setDeletionMessage] = useState("");
  const [deletionBusy, setDeletionBusy] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);
  const [sessionMessage, setSessionMessage] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [studyMinutes, setStudyMinutes] = useState(150);
  const [studyBusy, setStudyBusy] = useState(false);
  const [studyMessage, setStudyMessage] = useState("");
  useEffect(() => {
    const invitedCode = new URLSearchParams(location.hash.replace(/^#/, "")).get("join");
    if (invitedCode) {
      setJoinCode(invitedCode.toUpperCase());
      setJoinMessage("راجع رمز المقرر ثم اضغط «انضم».");
    }
  }, [location.hash]);
  useEffect(() => {
    api
      .health()
      .then(setH)
      .catch(() => setH({ status: "error" }));
    api
      .profile()
      .then((r) => {
        setProfile(r.profile);
        setStudyMinutes(Number(r.profile.dailyStudyMinutes || 150));
      })
      .catch(() => undefined);
  }, []);
  async function exportData() {
    setExportBusy(true);
    try {
      await api.exportMyData();
    } finally {
      setExportBusy(false);
    }
  }
  async function joinCourse() {
    if (!joinCode.trim()) return;
    setJoinBusy(true);
    setJoinMessage("");
    try {
      await api.joinCourse(joinCode.trim());
      setJoinMessage(t("settings.joinSuccess"));
      setJoinCode("");
    } catch (e: any) {
      setJoinMessage(e.message || t("settings.joinError"));
    } finally {
      setJoinBusy(false);
    }
  }
  async function revokeSessions() {
    setSessionBusy(true);
    setSessionMessage("");
    try {
      await api.revokeSessions();
      setSessionMessage(t("settings.revokeSuccess"));
    } catch (e: any) {
      setSessionMessage(e.message || t("settings.revokeError"));
    } finally {
      setSessionBusy(false);
    }
  }
  async function saveStudyMinutes() {
    setStudyBusy(true);
    setStudyMessage("");
    try {
      const r = await api.updateProfile({
        dailyStudyMinutes: Math.min(
          720,
          Math.max(30, Math.round(studyMinutes || 150)),
        ),
      });
      setProfile(r.profile);
      setStudyMinutes(Number(r.profile.dailyStudyMinutes || 150));
      setStudyMessage(t("settings.studySaved"));
    } catch (e: any) {
      setStudyMessage(e.message || t("settings.studyError"));
    } finally {
      setStudyBusy(false);
    }
  }
  async function requestDeletion() {
    const reason = window.prompt(t("settings.deletionPrompt"));
    if (!reason) return;
    setDeletionBusy(true);
    setDeletionMessage("");
    try {
      const r = await api.requestDeletion(reason, true);
      setDeletionMessage(
        t("settings.deletionLogged").replace("{status}", String(r.request.status)),
      );
    } catch (e: any) {
      setDeletionMessage(e.message || t("settings.deletionError"));
    } finally {
      setDeletionBusy(false);
    }
  }
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Preferences & Policy"
        title={t("settings.title")}
        description={t("settings.description")}
      />
      {h?.incidentBanner && (
        <div className="rounded-xl bg-[#f7eddd] dark:bg-[#332a1d] p-4 text-sm">
          {h.incidentBanner}
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-5">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <Sun size={17} className="brand-text" />
              <h2 className="section-title">{t("settings.appearance")}</h2>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {(["light", "dark", "system"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setTheme(v)}
                  className={`focus-ring rounded-xl border hairline p-3 text-xs font-semibold ${theme === v ? "brand-soft-bg" : ""}`}
                >
                  {v === "light"
                    ? t("settings.themeLight")
                    : v === "dark"
                      ? t("settings.themeDark")
                      : t("settings.themeSystem")}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <Eye size={17} className="brand-text" />
              <h2 className="section-title">{t("settings.accessibility")}</h2>
            </div>
            <p className="body-copy mt-2">{t("settings.accessibilityNote")}</p>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <Preference
                label={t("settings.highContrast")}
                active={accessibility.highContrast}
                onClick={() =>
                  setAccessibility({
                    highContrast: !accessibility.highContrast,
                  })
                }
              />
              <Preference
                label={t("settings.largeText")}
                active={accessibility.largeText}
                onClick={() =>
                  setAccessibility({ largeText: !accessibility.largeText })
                }
              />
              <Preference
                label={t("settings.reducedMotion")}
                active={accessibility.reducedMotion}
                onClick={() =>
                  setAccessibility({
                    reducedMotion: !accessibility.reducedMotion,
                  })
                }
              />
              <Preference
                label={t("settings.simplified")}
                active={accessibility.simplified}
                onClick={() =>
                  setAccessibility({ simplified: !accessibility.simplified })
                }
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <Languages size={17} className="brand-text" />
              <h2 className="section-title">{t("settings.language")}</h2>
            </div>
            <div className="mt-4 min-h-11 rounded-xl border hairline brand-soft-bg px-4 flex items-center justify-between text-xs font-semibold">
              <span>{t("settings.arabicLabel")}</span>
              <span dir="ltr">RTL · ar-KW</span>
            </div>
            <p className="body-copy mt-3">{t("settings.languageNote")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <UserRound size={17} className="brand-text" />
              <h2 className="section-title">{t("settings.academicProfile")}</h2>
            </div>
            {profile ? (
              <div className="mt-4">
                <div className="text-lg font-semibold">
                  {profile.displayName}
                </div>
                <div className="body-copy mt-1">
                  {[
                    profile.university,
                    profile.specialization,
                    profile.academicTerm,
                  ]
                    .filter(Boolean)
                    .join(" · ") || t("settings.profileEmpty")}
                </div>
                <div className="mt-5 pt-4 border-t hairline">
                  <div className="flex items-center gap-2">
                    <Clock3 size={14} className="brand-text" />
                    <span className="text-xs font-semibold">
                      {t("settings.focusBudget")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min={30}
                      max={720}
                      step={15}
                      value={studyMinutes}
                      onChange={(e) => setStudyMinutes(Number(e.target.value))}
                      className="field w-28"
                    />
                    <span className="text-[11px] muted">{t("settings.minutes")}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={saveStudyMinutes}
                      disabled={studyBusy}
                    >
                      {studyBusy ? t("settings.saving") : t("settings.save")}
                    </Button>
                  </div>
                  {studyMessage && (
                    <div className="text-[10px] muted mt-2">{studyMessage}</div>
                  )}
                  <div className="text-[10px] muted mt-2">
                    {t("settings.focusBudgetNote")}
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" className="mt-3 px-0">
                  <Link to="/app/onboarding">{t("settings.updateProfile")}</Link>
                </Button>
              </div>
            ) : (
              <div className="h-24 soft-bg rounded-xl mt-4 animate-pulse" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <KeyRound size={17} className="brand-text" />
              <h2 className="section-title">{t("settings.joinCourse")}</h2>
            </div>
            <p className="body-copy mt-3">{t("settings.joinNote")}</p>
            <div className="mt-4 flex gap-2">
              <input
                dir="ltr"
                className="field flex-1"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="AOS-XXXXXXXXXX"
              />
              <Button
                onClick={joinCourse}
                disabled={joinBusy || !joinCode.trim()}
              >
                {joinBusy ? t("settings.joining") : t("settings.join")}
              </Button>
            </div>
            {joinMessage && <p className="text-xs muted mt-3">{joinMessage}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <CreditCard size={17} className="brand-text" />
              <h2 className="section-title">الباقات والدفع لكل مشروع</h2>
            </div>
            <div className="mt-4 rounded-xl bg-[var(--bg)] border hairline p-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold">
                  {{
                    stripe: "Stripe",
                    tap: "Tap · KNET",
                    myfatoorah: "MyFatoorah",
                  }[h?.billing?.provider as string] || t("settings.paymentGateway")}
                </div>
                <div className="text-[10px] muted mt-1">
                  {h?.billing?.configured
                    ? t("settings.configuredServer")
                    : "جاهز لربط مفاتيح بوابة الدفع"}
                </div>
              </div>
              <span
                className={`h-2.5 w-2.5 rounded-full ${h?.billing?.configured ? "bg-emerald-500" : "bg-amber-500"}`}
              />
            </div>
            <Button className="mt-4" asChild><Link to="/app/plans">شاهد باقات المشاريع</Link></Button>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center gap-2">
              <Server size={17} className="brand-text" />
              <h2 className="section-title">{t("settings.servicesStatus")}</h2>
            </div>
            {h ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-5">
                <Service
                  label={t("settings.server")}
                  ok={h.status === "ok"}
                  value={h.status}
                />
                <Service
                  label="Firestore"
                  ok={h.firebase}
                  value={h.firebase ? "Configured" : "Not configured"}
                />
                <Service
                  label="Storage"
                  ok={h.storageConfigured}
                  value={h.storageConfigured ? "Configured" : "Not configured"}
                />
                <Service
                  label="AI Gateway"
                  ok={h.aiConfigured}
                  value={h.aiConfigured ? "Configured" : "Not configured"}
                />
                <Service
                  label="OCR"
                  ok={h.ocr?.configured}
                  value={
                    h.ocr?.ensemble
                      ? "Ensemble"
                      : h.ocr?.configured
                        ? "Single provider"
                        : "Not configured"
                  }
                />
                <Service
                  label="Malware scan"
                  ok={h.malware?.configured}
                  value={
                    h.malware?.configured ? "Configured" : "Not configured"
                  }
                />
                <Service
                  label="External notices"
                  ok={
                    h.notifications?.email ||
                    h.notifications?.push ||
                    h.notifications?.sms
                  }
                  value={
                    h.notifications?.email ||
                    h.notifications?.push ||
                    h.notifications?.sms
                      ? "Configured"
                      : "Not configured"
                  }
                />
                <Service
                  label="Backup"
                  ok={h.backup?.configured}
                  value={h.backup?.configured ? "Configured" : "Not configured"}
                />
                <Service
                  label="Data region"
                  ok
                  value={h.dataRegion || "global"}
                />
              </div>
            ) : (
              <div className="h-24 soft-bg rounded-xl mt-4 animate-pulse" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <Download size={17} className="brand-text" />
              <h2 className="section-title">{t("settings.myData")}</h2>
            </div>
            <p className="body-copy mt-3">{t("settings.myDataNote")}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={exportData}
              disabled={exportBusy}
            >
              {exportBusy ? t("settings.preparing") : "Download My Data"}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <ShieldCheck size={17} className="brand-text" />
              <h2 className="section-title">{t("settings.academicSecurity")}</h2>
            </div>
            <p className="body-copy mt-3">{t("settings.academicSecurityNote")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <KeyRound size={17} className="brand-text" />
              <h2 className="section-title">{t("settings.sessions")}</h2>
            </div>
            <p className="body-copy mt-3">{t("settings.sessionsNote")}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={revokeSessions}
              disabled={sessionBusy}
            >
              {sessionBusy ? t("settings.revoking") : t("settings.logoutAll")}
            </Button>
            {sessionMessage && (
              <p className="text-xs muted mt-3">{sessionMessage}</p>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardContent>
            <div className="flex items-center gap-2">
              <Trash2 size={17} className="text-[var(--danger)]" />
              <h2 className="section-title">{t("settings.accountDeletion")}</h2>
            </div>
            <p className="body-copy mt-3">{t("settings.accountDeletionNote")}</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={requestDeletion}
              disabled={deletionBusy}
            >
              {deletionBusy ? t("settings.logging") : t("settings.requestDeletion")}
            </Button>
            {deletionMessage && (
              <p className="text-xs muted mt-3">{deletionMessage}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
function Service({ label, ok, value }: any) {
  return (
    <div className="rounded-xl bg-[var(--bg)] border hairline p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">{label}</span>
        <span
          className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
        />
      </div>
      <div className="text-[10px] muted mt-2 truncate">{value}</div>
    </div>
  );
}
function Preference({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`focus-ring min-h-11 rounded-xl border hairline p-3 text-xs font-semibold ${active ? "brand-soft-bg" : ""}`}
    >
      {label}
      <span className="block text-[9px] muted mt-1">
        {active ? t("settings.on") : t("settings.off")}
      </span>
    </button>
  );
}
