import React from "react";
import { Link, Navigate, useParams } from "react-router";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { useI18n } from "../lib/i18n";

type PageContent = {
  eyebrow: string;
  title: string;
  intro: string;
  points: string[];
  note?: string;
};
// القيم أدناه مفاتيح تدويل ثابتة (namespace: pub.) تُترجم عند العرض عبر t().
const pages: Record<string, PageContent> = {
  students: {
    eyebrow: "pub.students.eyebrow",
    title: "pub.students.title",
    intro: "pub.students.intro",
    points: [
      "pub.students.point1",
      "pub.students.point2",
      "pub.students.point3",
      "pub.students.point4",
    ],
  },
  faculty: {
    eyebrow: "pub.faculty.eyebrow",
    title: "pub.faculty.title",
    intro: "pub.faculty.intro",
    points: [
      "pub.faculty.point1",
      "pub.faculty.point2",
      "pub.faculty.point3",
      "pub.faculty.point4",
    ],
  },
  universities: {
    eyebrow: "pub.universities.eyebrow",
    title: "pub.universities.title",
    intro: "pub.universities.intro",
    points: [
      "pub.universities.point1",
      "pub.universities.point2",
      "pub.universities.point3",
      "pub.universities.point4",
    ],
  },
  governments: {
    eyebrow: "pub.governments.eyebrow",
    title: "pub.governments.title",
    intro: "pub.governments.intro",
    points: [
      "pub.governments.point1",
      "pub.governments.point2",
      "pub.governments.point3",
      "pub.governments.point4",
    ],
    note: "pub.governments.note",
  },
  employers: {
    eyebrow: "pub.employers.eyebrow",
    title: "pub.employers.title",
    intro: "pub.employers.intro",
    points: [
      "pub.employers.point1",
      "pub.employers.point2",
      "pub.employers.point3",
      "pub.employers.point4",
    ],
    note: "pub.employers.note",
  },
  pricing: {
    eyebrow: "pub.pricing.eyebrow",
    title: "pub.pricing.title",
    intro: "pub.pricing.intro",
    points: [
      "pub.pricing.point1",
      "pub.pricing.point2",
      "pub.pricing.point3",
      "pub.pricing.point4",
    ],
    note: "pub.pricing.note",
  },
  security: {
    eyebrow: "pub.security.eyebrow",
    title: "pub.security.title",
    intro: "pub.security.intro",
    points: [
      "pub.security.point1",
      "pub.security.point2",
      "pub.security.point3",
      "pub.security.point4",
    ],
  },
  "academic-integrity": {
    eyebrow: "pub.academicIntegrity.eyebrow",
    title: "pub.academicIntegrity.title",
    intro: "pub.academicIntegrity.intro",
    points: [
      "pub.academicIntegrity.point1",
      "pub.academicIntegrity.point2",
      "pub.academicIntegrity.point3",
      "pub.academicIntegrity.point4",
    ],
  },
  about: {
    eyebrow: "pub.about.eyebrow",
    title: "pub.about.title",
    intro: "pub.about.intro",
    points: [
      "pub.about.point1",
      "pub.about.point2",
      "pub.about.point3",
      "pub.about.point4",
    ],
  },
  contact: {
    eyebrow: "pub.contact.eyebrow",
    title: "pub.contact.title",
    intro: "pub.contact.intro",
    points: [
      "pub.contact.point1",
      "pub.contact.point2",
      "pub.contact.point3",
      "pub.contact.point4",
    ],
  },
  faq: {
    eyebrow: "pub.faq.eyebrow",
    title: "pub.faq.title",
    intro: "pub.faq.intro",
    points: [
      "pub.faq.point1",
      "pub.faq.point2",
      "pub.faq.point3",
      "pub.faq.point4",
    ],
  },
  terms: {
    eyebrow: "pub.terms.eyebrow",
    title: "pub.terms.title",
    intro: "pub.terms.intro",
    points: [
      "pub.terms.point1",
      "pub.terms.point2",
      "pub.terms.point3",
      "pub.terms.point4",
    ],
    note: "pub.terms.note",
  },
  privacy: {
    eyebrow: "pub.privacy.eyebrow",
    title: "pub.privacy.title",
    intro: "pub.privacy.intro",
    points: [
      "pub.privacy.point1",
      "pub.privacy.point2",
      "pub.privacy.point3",
      "pub.privacy.point4",
    ],
    note: "pub.privacy.note",
  },
  "acceptable-use": {
    eyebrow: "pub.acceptableUse.eyebrow",
    title: "pub.acceptableUse.title",
    intro: "pub.acceptableUse.intro",
    points: [
      "pub.acceptableUse.point1",
      "pub.acceptableUse.point2",
      "pub.acceptableUse.point3",
      "pub.acceptableUse.point4",
    ],
    note: "pub.acceptableUse.note",
  },
  "ai-policy": {
    eyebrow: "pub.aiPolicy.eyebrow",
    title: "pub.aiPolicy.title",
    intro: "pub.aiPolicy.intro",
    points: [
      "pub.aiPolicy.point1",
      "pub.aiPolicy.point2",
      "pub.aiPolicy.point3",
      "pub.aiPolicy.point4",
    ],
  },
  accessibility: {
    eyebrow: "pub.accessibility.eyebrow",
    title: "pub.accessibility.title",
    intro: "pub.accessibility.intro",
    points: [
      "pub.accessibility.point1",
      "pub.accessibility.point2",
      "pub.accessibility.point3",
      "pub.accessibility.point4",
    ],
    note: "pub.accessibility.note",
  },
};

export function PublicPage() {
  const { t } = useI18n();
  const { slug = "about" } = useParams();
  if (["universities", "governments", "employers"].includes(slug))
    return <Navigate to="/" replace />;
  const c = pages[slug] || pages.about;
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="h-18 px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="focus-ring flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl brand-bg grid place-items-center text-xs font-semibold">
            AO
          </div>
          <div>
            <div className="font-semibold">AcademicOS</div>
            <div className="text-[9px] muted">
              {t("pub.header.tagline")}
            </div>
          </div>
        </Link>
        <div className="flex gap-2">
          <Button variant="ghost" asChild>
            <Link to="/">{t("pub.nav.home")}</Link>
          </Button>
          <Button asChild>
            <Link to="/app">
              {t("pub.nav.open")} <ArrowRight size={15} className="directional-icon" />
            </Link>
          </Button>
        </div>
      </header>
      <main className="border-y hairline paper-grid">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-20 md:py-28">
          <div className="eyebrow brand-text">{t(c.eyebrow)}</div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-[-.05em] leading-[1.08] mt-4 max-w-4xl">
            {t(c.title)}
          </h1>
          <p className="text-base md:text-lg leading-8 muted mt-6 max-w-3xl">
            {t(c.intro)}
          </p>
          <div className="grid md:grid-cols-2 gap-3 mt-10">
            {c.points.map((x) => (
              <div key={x} className="panel-flat rounded-2xl p-5 flex gap-3">
                <CheckCircle2
                  size={18}
                  className="brand-text shrink-0 mt-0.5"
                />
                <span className="text-sm leading-6">{t(x)}</span>
              </div>
            ))}
          </div>
          {slug === "security" && (
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to="/security-report">{t("pub.security.reportingBtn")}</Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/status">{t("pub.security.statusBtn")}</Link>
              </Button>
            </div>
          )}
          {c.note && (
            <div className="mt-6 rounded-2xl border hairline bg-[var(--panel)] p-5 flex gap-3">
              <ShieldCheck size={18} className="brand-text shrink-0" />
              <p className="body-copy">{t(c.note)}</p>
            </div>
          )}
        </div>
      </main>
      <footer className="px-4 md:px-8 py-8">
        <div className="max-w-5xl mx-auto text-xs muted">
          {t("pub.footer.tagline")}
        </div>
      </footer>
    </div>
  );
}
