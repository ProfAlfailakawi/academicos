import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, BookOpenCheck, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import type { SkillEvidence } from "../types";
import { PageHeader } from "../components/PageHeader";
import { Card, CardContent } from "../components/ui/card";
import { SkillRadar, hasSkillRadar } from "../components/VisualBits";
import { EmptyState } from "../components/EmptyState";
import { formatDate, useI18n } from "../lib/i18n";
import { Skeleton } from "../components/ui/Skeleton";

export function Skills() {
  const { t, locale } = useI18n();
  const [skills, setSkills] = useState<SkillEvidence[] | null>(null);
  useEffect(() => {
    api
      .skills()
      .then((r) => setSkills(r.skills))
      .catch(() => setSkills([]));
  }, []);
  const grouped = useMemo(() => {
    const m = new Map<string, SkillEvidence[]>();
    (skills || []).forEach((s) =>
      m.set(s.skill, [...(m.get(s.skill) || []), s]),
    );
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [skills]);
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("ui.skillGenome")}
        title={t("skills.title")}
        description={t("skills.description")}
      />
      {skills === null ? (
        <Skeleton shape="panel" />
      ) : grouped.length ? (
        <>
          {hasSkillRadar(skills || []) && (
            <Card>
              <CardContent>
                <SkillRadar
                  skills={skills || []}
                  ariaLabel={t("ui.skillGenome")}
                />
              </CardContent>
            </Card>
          )}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {grouped.map(([name, evidence]) => (
              <Card key={name}>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-xl tone-tile">
                      <BookOpenCheck size={17} />
                    </div>
                    <h2 className="section-title min-w-0 flex-1">{name}</h2>
                    <span className="shrink-0 text-meta muted">
                      {evidence.length} {t("skills.evidenceUnit")}
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {evidence.slice(0, 3).map((e) => (
                      <Link
                        key={e.id}
                        to={`/app/project/${e.projectId}`}
                        className="focus-ring block rounded-xl bg-[var(--bg)] border hairline p-3 hover:bg-[var(--panel-2)]"
                      >
                        <div className="text-xs font-semibold line-clamp-1">
                          {e.projectTitle}
                        </div>
                        <div className="text-meta muted mt-1">
                          {e.course} · {formatDate(e.date, locale)}
                        </div>
                        <div className="mt-2 flex items-center gap-1 text-meta brand-text">
                          <ShieldCheck size={12} />
                          {e.verificationLevel === "institution"
                            ? t("skills.verifyInstitution")
                            : e.verificationLevel === "project"
                              ? t("skills.verifyProject")
                              : t("skills.verifySelf")}
                        </div>
                      </Link>
                    ))}
                  </div>
                  {evidence.length > 3 && (
                    <div className="text-meta muted mt-3">
                      + {evidence.length - 3} {t("skills.moreEvidence")}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <EmptyState scene="skills"
          title={t("skills.emptyTitle")}
          description={t("skills.emptyDescription")}
        />
      )}
    </div>
  );
}
