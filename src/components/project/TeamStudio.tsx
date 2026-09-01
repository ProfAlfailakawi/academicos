import React, { useEffect, useMemo, useState } from "react";
import {
  LoaderCircle,
  Mail,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { api } from "../../lib/api";
import type {
  ProjectActivityRecord,
  ProjectDNA,
  ProjectMemberRecord,
  ProjectPresenceRecord,
} from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useI18n } from "../../lib/i18n";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export function TeamStudio({ project }: { project: ProjectDNA }) {
  const { user } = useAuth();
  const { t } = useI18n();
  const [members, setMembers] = useState<ProjectMemberRecord[]>([]);
  const [presence, setPresence] = useState<ProjectPresenceRecord[]>([]);
  const [activity, setActivity] = useState<ProjectActivityRecord[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const isOwner = user?.id === project.userId;
  function load() {
    setLoading(true);
    Promise.all([
      api.projectMembers(project.id),
      api.activity(project.id),
      api.projectPresence(project.id),
    ])
      .then(([m, a, p]) => {
        setMembers(m.members);
        setActivity(a.activity);
        setPresence(p.presence);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }
  useEffect(load, [project.id]);
  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const tick = async () => {
      try {
        await api.heartbeatPresence(project.id, "team");
        if (!stopped) {
          const p = await api.projectPresence(project.id);
          if (!stopped) setPresence(p.presence);
        }
      } catch {}
    };
    tick();
    const id = window.setInterval(tick, 20000);
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [project.id, user?.id]);
  const contributions = useMemo(() => {
    const map = new Map<
      string,
      { actor: string; count: number; actions: Record<string, number> }
    >();
    for (const a of activity) {
      const item = map.get(a.actor) || {
        actor: a.actor,
        count: 0,
        actions: {},
      };
      item.count++;
      item.actions[a.action] = (item.actions[a.action] || 0) + 1;
      map.set(a.actor, item);
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [activity]);
  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner || project.collaborationMode !== "group" || !email.trim())
      return;
    setBusy("invite");
    setError("");
    try {
      const r = await api.inviteProjectMember(project.id, email.trim());
      setMembers((v) => [...v.filter((x) => x.id !== r.member.id), r.member]);
      setEmail("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function revoke(m: ProjectMemberRecord) {
    if (!isOwner) return;
    setBusy(m.id);
    setError("");
    try {
      const r = await api.updateProjectMember(project.id, m.id, {
        status: "revoked",
      });
      setMembers((v) => v.map((x) => (x.id === m.id ? r.member : x)));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="grid xl:grid-cols-[.95fr_1.05fr] gap-5">
      <div className="space-y-5">
        <Card>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <UsersRound size={18} className="brand-text" />
                  <h2 className="section-title">{t("ui.teamStudio")}</h2>
                </div>
                <p className="body-copy mt-2">{t("team.studioDesc")}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[9px] font-semibold ${project.collaborationMode === "group" ? "brand-soft-bg" : "soft-bg muted"}`}
              >
                {project.collaborationMode === "group"
                  ? t("ui.groupProject")
                  : t("ui.individual")}
              </span>
            </div>
            {project.collaborationMode !== "group" ? (
              <div className="mt-5 rounded-xl bg-[#f7eddd] text-[var(--warning)] dark:bg-[#332a1d] p-4 text-xs leading-6">
                {t("team.individualNotice")}
              </div>
            ) : isOwner ? (
              <form onSubmit={invite} className="mt-5">
                <label className="text-[11px] font-semibold muted">
                  {t("team.inviteLabel")}
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="email"
                    className="field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    disabled={busy === "invite"}
                  />
                  <Button
                    type="submit"
                    disabled={busy === "invite" || !email.trim()}
                  >
                    {busy === "invite" ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <UserPlus size={15} />
                    )}
                    {t("team.invite")}
                  </Button>
                </div>
                <p className="text-[9px] muted mt-2">{t("team.inviteHint")}</p>
              </form>
            ) : (
              <div className="mt-5 rounded-xl soft-bg p-4 text-xs muted">
                {t("team.memberNotice")}
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-xl border border-[var(--danger)]/20 p-3 text-xs text-[var(--danger)]">
                {error}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="eyebrow">{t("ui.presence")}</div>
                <h2 className="section-title mt-1">{t("team.presenceTitle")}</h2>
              </div>
              <span className="text-[11px] muted">
                {presence.length} {t("ui.online")}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {presence.length ? (
                presence.map((p) => (
                  <div
                    key={p.userId}
                    className="rounded-full border hairline px-3 py-1.5 text-[10px] flex items-center gap-2"
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold">
                      {p.userId === user?.id ? t("team.you") : p.displayName}
                    </span>
                    <span className="muted">{p.location || t("ui.projectLocation")}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs muted">
                  {t("team.noPresence")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow">{t("ui.membership")}</div>
                <h2 className="section-title mt-1">{t("team.membersTitle")}</h2>
              </div>
              {loading ? (
                <LoaderCircle size={16} className="animate-spin brand-text" />
              ) : (
                <span className="text-[11px] muted">
                  {members.filter((m) => m.status === "active").length + 1}{" "}
                  {t("team.active")}
                </span>
              )}
            </div>
            <div className="mt-5 space-y-2">
              <MemberRow
                owner
                name={
                  isOwner
                    ? user?.displayName || t("team.you")
                    : t("team.ownerName")
                }
                meta={project.userId}
              />
              {members
                .filter((m) => m.status !== "revoked")
                .map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl border hairline p-3 flex items-center gap-3"
                  >
                    <div className="h-9 w-9 rounded-xl soft-bg grid place-items-center">
                      <Mail size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate">
                        {m.displayName || m.email}
                      </div>
                      <div className="text-[9px] muted mt-1">
                        {m.status === "pending"
                          ? t("team.pendingInvite")
                          : m.role === "leader"
                            ? t("team.roleLeader")
                            : t("team.roleMember")}{" "}
                        · {m.email}
                      </div>
                    </div>
                    {isOwner && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("team.revokeMembership")}
                        disabled={busy === m.id}
                        onClick={() => revoke(m)}
                      >
                        {busy === m.id ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="brand-text" />
            <div>
              <h2 className="section-title">{t("ui.contributionProof")}</h2>
              <p className="body-copy mt-1">{t("team.contributionDesc")}</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {contributions.length ? (
              contributions.map((c) => {
                const member = members.find((m) => m.userId === c.actor);
                const name =
                  c.actor === project.userId
                    ? isOwner
                      ? user?.displayName || t("team.ownerName")
                      : t("team.ownerName")
                    : member?.displayName || member?.email || short(c.actor);
                return (
                  <div
                    key={c.actor}
                    className="rounded-2xl border hairline p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{name}</div>
                        <div className="text-[9px] muted mt-1">
                          {short(c.actor)}
                        </div>
                      </div>
                      <div className="text-2xl font-semibold mono-number">
                        {c.count}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(Object.entries(c.actions) as Array<[string, number]>)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 8)
                        .map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-full soft-bg px-2 py-1 text-[9px] muted"
                          >
                            {label(k, t)} · {v}
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="soft-bg rounded-xl p-5 text-sm muted">
                {t("team.noContributions")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
function MemberRow({
  owner,
  name,
  meta,
}: {
  owner?: boolean;
  name: string;
  meta: string;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border hairline p-3 flex items-center gap-3">
      <div className="h-9 w-9 rounded-xl brand-soft-bg grid place-items-center">
        <UsersRound size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold">{name}</div>
        <div className="text-[9px] muted mt-1">
          {owner ? t("ui.ownerLeader") : t("ui.member")} · {short(meta)}
        </div>
      </div>
    </div>
  );
}
function short(v: string) {
  return v.length > 22 ? `${v.slice(0, 8)}…${v.slice(-5)}` : v;
}
function label(v: string, t: (key: string) => string) {
  const key = `team.label.${v}`;
  const translated = t(key);
  if (translated !== key) return translated;
  return v.split(".").pop() || v;
}
