import { AppDialog } from "../AppDialog";
import { localizedUiError } from "../../lib/ui-error";
import React, { useEffect, useState } from "react";
import {
  Clock3,
  History,
  LoaderCircle,
  MessageSquareText,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { api } from "../../lib/api";
import { formatDateTime, useI18n } from "../../lib/i18n";
import type {
  ProjectActivityRecord,
  ProjectComment,
  ProjectDNA,
  ProjectVersionRecord,
} from "../../types";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

export function ReviewStudio({
  project,
  onRestored,
}: {
  project: ProjectDNA;
  onRestored: (project: ProjectDNA) => void;
}) {
  const { t, locale } = useI18n();
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [restoreCandidate, setRestoreCandidate] =
    useState<ProjectVersionRecord | null>(null);
  const [versions, setVersions] = useState<ProjectVersionRecord[]>([]);
  const [activity, setActivity] = useState<ProjectActivityRecord[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [restoring, setRestoring] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [c, v, a] = await Promise.all([
        api.comments(project.id),
        api.versions(project.id),
        api.activity(project.id),
      ]);
      setComments(c.comments);
      setVersions(v.versions);
      setActivity(a.activity);
    } catch (e: any) {
      setError(localizedUiError(e, t, "review.loadError"));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, [project.id]);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    const value = body.trim();
    if (!value) return;
    setPosting(true);
    setError("");
    try {
      const r = await api.addComment(project.id, value);
      setComments((prev) => [...prev, r.comment]);
      setBody("");
      const a = await api.activity(project.id);
      setActivity(a.activity);
    } catch (e: any) {
      setError(localizedUiError(e, t, "review.saveCommentError"));
    } finally {
      setPosting(false);
    }
  }
  async function removeComment(id: string) {
    setError("");
    try {
      await api.deleteComment(project.id, id);
      setComments((prev) => prev.filter((c) => c.id !== id));
      const a = await api.activity(project.id);
      setActivity(a.activity);
    } catch (e: any) {
      setError(localizedUiError(e, t, "review.deleteCommentError"));
    }
  }
  async function restore(version: ProjectVersionRecord) {
    if (restoring) return;
    setRestoreCandidate(version);
  }

  async function confirmRestore() {
    const version = restoreCandidate;
    if (!version || restoring) return;

    setRestoreCandidate(null);
    setRestoring(version.id);
    setError("");

    try {
      const r = await api.restoreVersion(project.id, version.id);
      onRestored(r.project);
      await refresh();
    } catch (e) {
      setError(localizedUiError(e, t, "review.restoreError"));
    } finally {
      setRestoring("");
    }
  }


  if (loading)
    return (
      <div className="panel-flat rounded-2xl min-h-72 grid place-items-center">
        <LoaderCircle className="animate-spin brand-text" />
      </div>
    );
  return (
    <div className="grid xl:grid-cols-[1.05fr_.95fr] gap-5">
      <div className="space-y-5">
        <Card>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquareText size={18} className="brand-text" />
                  <h2 className="section-title">{t("review.commentsTitle")}</h2>
                </div>
                <p className="body-copy mt-2">{t("review.commentsDesc")}</p>
              </div>
              <span className="text-[11px] muted mono-number">
                {comments.length}
              </span>
            </div>
            <form onSubmit={addComment} className="mt-5">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={posting}
                maxLength={4000}
                rows={4}
                placeholder={t("review.commentPlaceholder")}
                className="field resize-y min-h-28"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[10px] muted mono-number">
                  {body.length}/4000
                </span>
                <Button type="submit" disabled={posting || !body.trim()}>
                  {posting ? (
                    <LoaderCircle size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  {t("review.saveNote")}
                </Button>
              </div>
            </form>
            <div className="mt-6 space-y-2">
              {comments.length ? (
                comments.map((c) => (
                  <div key={c.id} className="rounded-xl border hairline p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {c.displayName}
                        </div>
                        <div className="text-[10px] muted mt-1">
                          {formatDateTime(c.createdAt, locale)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("review.deleteComment")}
                        onClick={() => removeComment(c.id)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                    <p className="text-sm leading-7 mt-3 whitespace-pre-wrap">
                      {c.body}
                    </p>
                    {c.mentions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {c.mentions.map((m) => (
                          <span
                            key={m}
                            className="rounded-full brand-soft-bg px-2 py-1 text-[10px]"
                          >
                            @{m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-xl soft-bg p-5 text-sm muted">
                  {t("review.noComments")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock3 size={18} className="brand-text" />
              <h2 className="section-title">{t("ui.activityTrail")}</h2>
            </div>
            <p className="body-copy mt-2">{t("review.activityDesc")}</p>
            <div className="mt-5 space-y-0">
              {activity.length ? (
                activity.slice(0, 80).map((a, i) => (
                  <div key={a.id} className="grid grid-cols-[18px_1fr] gap-3">
                    <div className="flex flex-col items-center">
                      <div className="mt-1.5 h-2 w-2 rounded-full brand-bg" />
                      {i < Math.min(activity.length, 80) - 1 && (
                        <div className="w-px flex-1 bg-[var(--line)] min-h-10" />
                      )}
                    </div>
                    <div className="pb-5">
                      <div className="text-xs font-semibold">
                        {actionLabel(a.action, t)}
                      </div>
                      <div className="text-[10px] muted mt-1">
                        {formatDateTime(a.timestamp, locale)} · {shortActor(a.actor)}
                      </div>
                      {a.reason && (
                        <div className="text-xs muted mt-1">{a.reason}</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="soft-bg rounded-xl p-4 text-sm muted">
                  {t("review.noActivity")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="xl:sticky xl:top-24">
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <History size={18} className="brand-text" />
                  <h2 className="section-title">{t("ui.versionHistory")}</h2>
                </div>
                <p className="body-copy mt-2">{t("review.versionHistoryDesc")}</p>
              </div>
              <span className="text-[11px] muted mono-number">
                {versions.length}
              </span>
            </div>
            <div className="mt-5 space-y-2 max-h-[70vh] overflow-auto pe-1">
              {versions.length ? (
                versions.map((v) => (
                  <div key={v.id} className="rounded-xl border hairline p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">
                          {t("review.versionLabel")} {v.versionNumber}
                        </div>
                        <div className="text-[10px] muted mt-1">
                          {formatDateTime(v.createdAt, locale)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={Boolean(restoring)}
                        onClick={() => restore(v)}
                      >
                        {restoring === v.id ? (
                          <LoaderCircle size={14} className="animate-spin" />
                        ) : (
                          <RotateCcw size={14} />
                        )}
                        {t("review.restore")}
                      </Button>
                    </div>
                    <p className="text-xs leading-6 muted mt-3">{v.summary}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <SnapshotMetric
                        label={t("review.metricProgress")}
                        value={`${v.snapshot.progress}%`}
                      />
                      <SnapshotMetric
                        label={t("review.metricTasks")}
                        value={`${v.snapshot.tasks.filter((t) => t.status === "completed").length}/${v.snapshot.tasks.length}`}
                      />
                      <SnapshotMetric
                        label={t("review.metricDeliverables")}
                        value={`${v.snapshot.deliverables.filter((d) => d.status === "ready" || d.status === "completed").length}/${v.snapshot.deliverables.length}`}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="soft-bg rounded-xl p-4 text-sm muted">
                  {t("review.noVersions")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      {error && (
        <div className="xl:col-span-2 rounded-xl border border-[var(--danger)]/20 bg-[var(--panel)] p-3 text-xs text-danger">
          {error}
        </div>
      )}

      <AppDialog
        open={Boolean(restoreCandidate)}
        title={t("review.restore")}
        description={
          restoreCandidate
            ? `${t("review.restoreConfirmPrefix")} ${restoreCandidate.versionNumber}${t("review.restoreConfirmSuffix")}`
            : ""
        }
        busy={Boolean(restoring)}
        onCancel={() => setRestoreCandidate(null)}
        onConfirm={confirmRestore}
      />
    </div>
  );
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-bg rounded-lg p-2">
      <div className="text-[9px] muted">{label}</div>
      <div className="text-xs font-semibold mt-1 mono-number">{value}</div>
    

</div>
  );
}
function shortActor(value: string) {
  return value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-5)}` : value;
}
function actionLabel(value: string, t: (key: string) => string) {
  const key = `review.action.${value}`;
  const label = t(key);
  return label === key ? value.replaceAll(".", " · ") : label;
}
