import React from "react";
import { Link } from "react-router";
import {
  ArrowRight, BookOpenCheck, Check, FileCheck2, FilePenLine, FileSearch,
  GraduationCap, Languages, MessageCircleQuestion, ScanSearch, ShieldCheck,
  Sparkles, UploadCloud, Users,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Logo } from "../components/brand/Logo";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { formatMoney, useI18n } from "../lib/i18n";

export function PublicHome() {
  const { t, locale } = useI18n();
  const journey = [
    { icon: FilePenLine, title: t("landing.writeTitle"), text: t("landing.writeText"), to: "/login", tone: "mint" },
    { icon: ScanSearch, title: t("landing.rescueTitle"), text: t("landing.rescueText"), to: "/login", tone: "sand" },
    { icon: GraduationCap, title: t("landing.examTitle"), text: t("landing.examText"), to: "/login", tone: "blue" },
  ];
  const projectPrice = formatMoney(6.99, "USD", locale);
  return (
    <div className="public-shell min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="public-header px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between gap-3">
        <Link to="/" className="min-h-11 flex items-center gap-3 focus-ring rounded-xl">
          <Logo markSize={40} caption={t("landing.tagline")} />
        </Link>
        <nav className="hidden lg:flex items-center gap-1 text-sm">
          <a href="#how" className="focus-ring rounded-xl px-3 py-2 muted hover:text-[var(--ink)]">{t("landing.navHow")}</a>
          <a href="#pricing" className="focus-ring rounded-xl px-3 py-2 muted hover:text-[var(--ink)]">{t("landing.navPricing")}</a>
          <a href="#teacher" className="focus-ring rounded-xl px-3 py-2 muted hover:text-[var(--ink)]">{t("landing.navTeacher")}</a>
        </nav>
        <div className="flex items-center gap-2"><LanguageSwitcher compact /><Button variant="ghost" asChild className="hidden sm:inline-flex"><Link to="/login">{t("landing.signIn")}</Link></Button><Button asChild><Link to="/login">{t("landing.tryNow")} <ArrowRight size={16} className="directional-icon" /></Link></Button></div>
      </header>

      <main>
        <section className="public-student-hero border-y hairline overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-14 md:py-20 grid lg:grid-cols-[.95fr_1.05fr] gap-10 items-center">
            <div>
              <div className="student-proof-chip"><Sparkles size={15} /> {t("landing.globalChip")}</div>
              <h1 className="text-[43px] sm:text-[58px] xl:text-[72px] font-black tracking-[-.055em] leading-[1.03] mt-6">{t("landing.heroLine1")}<br /><span className="brand-text">{t("landing.heroLine2")}</span></h1>
              <p className="text-base md:text-lg leading-8 muted mt-6 max-w-2xl">{t("landing.heroBody")}</p>
              <div className="flex flex-wrap gap-3 mt-8"><Button size="lg" asChild><Link to="/login">{t("landing.startProject")} <ArrowRight size={17} className="directional-icon" /></Link></Button><Button size="lg" variant="outline" asChild><a href="#how">{t("landing.seeJourney")}</a></Button></div>
              <div className="grid grid-cols-3 gap-2 mt-8 max-w-xl"><Proof icon={Languages} label={t("landing.proofLanguage")} /><Proof icon={ShieldCheck} label={t("landing.proofSources")} /><Proof icon={Users} label={t("landing.proofPersonal")}/></div>
            </div>
            <div className="student-hero-visual">
              <img src="/assets/academicos-project-journey.png" alt={t("landing.heroImageAlt")} />
              <div className="hero-result-card"><FileCheck2 size={18} /><span><strong>92%</strong> {t("landing.vivaReady")}</span></div>
            </div>
          </div>
        </section>

        <section id="how" className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto"><div className="eyebrow brand-text">{t("landing.chooseGoal")}</div><h2 className="text-3xl md:text-5xl font-black tracking-[-.045em] mt-3">{t("landing.threeDoors")}</h2></div>
          <div className="journey-grid mt-10">{journey.map((item) => <Journey key={item.title} {...item} />)}</div>
          <div className="understanding-flow mt-12"><Flow icon={UploadCloud} n="1" title={t("landing.flowUpload")} text={t("landing.flowUploadText")} /><Flow icon={FilePenLine} n="2" title={t("landing.flowBuild")} text={t("landing.flowBuildText")} /><Flow icon={FileSearch} n="3" title={t("landing.flowCheck")} text={t("landing.flowCheckText")} /><Flow icon={MessageCircleQuestion} n="4" title={t("landing.flowDefend")} text={t("landing.flowDefendText")} /></div>
        </section>

        <section className="public-xray-section border-y hairline">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
            <div className="xray-visual panel">
              <div className="flex items-center justify-between"><span className="eyebrow">{t("ui.projectXray")}</span><span className="quality-badge">{t("landing.readyLabel")} 86%</span></div>
              <div className="xray-score-grid mt-7"><Score value="91" label={t("landing.structure")} /><Score value="78" label={t("landing.sources")} /><Score value="88" label={t("landing.coherence")} /></div>
              <div className="xray-finding mt-6"><Check size={16} /> {t("landing.findingGood")}</div>
              <div className="xray-finding xray-finding--warn"><FileSearch size={16} /> {t("landing.findingWarn")}</div>
            </div>
            <div>
              <div className="eyebrow brand-text">{t("landing.guardianEyebrow")}</div><h2 className="text-3xl md:text-5xl font-black tracking-[-.045em] mt-3">{t("landing.guardianTitle")}</h2>
              <p className="body-copy text-base mt-5">{t("landing.guardianBody")}</p>
              <ul className="feature-check-list mt-6"><li><ShieldCheck size={18} /> {t("landing.guardianSource")}</li><li><Sparkles size={18} /> {t("landing.guardianAdaptive")}</li><li><BookOpenCheck size={18} /> {t("landing.guardianHistory")}</li></ul>
            </div>
          </div>
        </section>

        <section id="pricing" className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="pricing-preview">
            <div><div className="eyebrow">{t("landing.studentPrice")}</div><h2 className="text-3xl md:text-5xl font-black tracking-[-.045em] mt-3">{t("landing.priceHeadline").replace("{price}", projectPrice)}</h2><p className="body-copy mt-4">{t("landing.priceBody")}</p></div>
            <div className="price-orbit"><span className="price-orbit__amount">{projectPrice}</span><span className="price-orbit__currency">{t("landing.perProject")}</span><Button asChild className="mt-5"><Link to="/login">{t("landing.seePlans")}</Link></Button></div>
          </div>
        </section>

        <section id="teacher" className="teacher-lite-strip surface-deep strip-deep">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4"><span className="h-12 w-12 rounded-2xl bg-white/12 grid place-items-center shrink-0"><GraduationCap size={23} /></span><div><div className="eyebrow text-white/65">ProfessorOS · {t("landing.optional")}</div><h2 className="text-2xl font-bold mt-1">{t("landing.teacherTitle")}</h2></div></div>
            <Button variant="outline" asChild className="btn-on-deep"><Link to="/login">{t("landing.teacherSignIn")}</Link></Button>
          </div>
        </section>
      </main>

      <footer className="px-4 md:px-8 py-8"><div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 justify-between text-xs muted"><span>AcademicOS — {t("landing.footerTag")}</span><span className="flex flex-wrap gap-x-4"><Link className="min-h-11 inline-flex items-center" to="/p/academic-integrity">{t("landing.integrity")}</Link><Link className="min-h-11 inline-flex items-center" to="/p/privacy">{t("landing.privacy")}</Link><Link className="min-h-11 inline-flex items-center" to="/p/terms">{t("landing.terms")}</Link><Link className="min-h-11 inline-flex items-center" to="/p/faq">{t("landing.faq")}</Link></span></div></footer>
    </div>
  );
}

function Proof({ icon: Icon, label }: { icon: React.ElementType; label: string }) { return <div className="proof-mini"><Icon size={17} /><span>{label}</span></div>; }
function Journey({ icon: Icon, title, text, to, tone }: { icon: React.ElementType; title: string; text: string; to: string; tone: string }) { return <Link to={to} className={`journey-card journey-card--${tone} focus-ring`}><span className="journey-card__icon"><Icon size={26} /></span><div><h3>{title}</h3><p>{text}</p></div><ArrowRight size={20} className="journey-card__arrow directional-icon" /></Link>; }
function Flow({ icon: Icon, n, title, text }: { icon: React.ElementType; n: string; title: string; text: string }) { return <div className="understanding-step"><span className="understanding-step__number">{n}</span><Icon size={23} /><strong>{title}</strong><small>{text}</small></div>; }
function Score({ value, label }: { value: string; label: string }) { return <div className="xray-score"><strong>{value}</strong><span>{label}</span></div>; }
