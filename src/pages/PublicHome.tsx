import React from "react";
import { Link } from "react-router";
import {
  ArrowLeft, BookOpenCheck, Check, FileCheck2, FilePenLine, FileSearch,
  GraduationCap, Languages, MessageCircleQuestion, ScanSearch, ShieldCheck,
  Sparkles, UploadCloud, Users,
} from "lucide-react";
import { Button } from "../components/ui/button";

const journey = [
  { icon: FilePenLine, title: "اكتب مشروعي", text: "من ملف التكليف إلى مشروع منظم قابل للتعديل والتصدير.", to: "/login", tone: "mint" },
  { icon: ScanSearch, title: "طوّر مسودتي", text: "ارفع ما كتبته وخذ تشخيصاً واضحاً ثم أصلح كل قسم.", to: "/login", tone: "sand" },
  { icon: GraduationCap, title: "درّبني للاختبار", text: "حل، تلميح، شرح صوتي، وسؤال مشابه يثبت الفهم.", to: "/login", tone: "blue" },
];

export function PublicHome() {
  return (
    <div dir="rtl" className="public-shell min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="public-header px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="min-h-11 flex items-center gap-3 focus-ring rounded-xl">
          <div className="h-10 w-10 rounded-2xl brand-bg grid place-items-center text-xs font-black">AO</div>
          <div><div className="font-bold">AcademicOS</div><div className="text-[10px] muted">مشروعك من البداية إلى المناقشة</div></div>
        </Link>
        <nav className="hidden lg:flex items-center gap-1 text-sm">
          <a href="#how" className="focus-ring rounded-xl px-3 py-2 muted hover:text-[var(--ink)]">كيف يعمل؟</a>
          <a href="#pricing" className="focus-ring rounded-xl px-3 py-2 muted hover:text-[var(--ink)]">الأسعار</a>
          <a href="#teacher" className="focus-ring rounded-xl px-3 py-2 muted hover:text-[var(--ink)]">للمعلم</a>
        </nav>
        <div className="flex items-center gap-2"><Button variant="ghost" asChild><Link to="/login">دخول</Link></Button><Button asChild><Link to="/login">جرّبه الآن <ArrowLeft size={16} /></Link></Button></div>
      </header>

      <main>
        <section className="public-student-hero border-y hairline overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-14 md:py-20 grid lg:grid-cols-[.95fr_1.05fr] gap-10 items-center">
            <div>
              <div className="student-proof-chip"><Sparkles size={15} /> للطالب أولاً · من الكويت لكل اللغات</div>
              <h1 className="text-[43px] sm:text-[58px] xl:text-[72px] font-black tracking-[-.055em] leading-[1.03] mt-6">مشروعك كامل.<br /><span className="brand-text">فاهمه. جاهز تناقشه.</span></h1>
              <p className="text-base md:text-lg leading-8 muted mt-6 max-w-2xl">ارفع التكليف. اختر مستوى المساعدة. ابنِ مشروعاً منظماً قسماً بقسم، ثم افحصه وتدرّب على أسئلة الدكتور.</p>
              <div className="flex flex-wrap gap-3 mt-8"><Button size="lg" asChild><Link to="/login">ابدأ مشروعك <ArrowLeft size={17} /></Link></Button><Button size="lg" variant="outline" asChild><a href="#how">شاهد الرحلة</a></Button></div>
              <div className="grid grid-cols-3 gap-2 mt-8 max-w-xl"><Proof icon={Languages} label="بلغتك" /><Proof icon={ShieldCheck} label="بلا مصادر وهمية" /><Proof icon={Users} label="نسخة مختلفة لكل طالب" /></div>
            </div>
            <div className="student-hero-visual">
              <img src="/assets/academicos-project-journey.png" alt="رحلة الطالب من التكليف إلى مشروع جاهز للمناقشة" />
              <div className="hero-result-card"><FileCheck2 size={18} /><span><strong>92%</strong> جاهزية للمناقشة</span></div>
            </div>
          </div>
        </section>

        <section id="how" className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="text-center max-w-2xl mx-auto"><div className="eyebrow brand-text">اختر هدفك</div><h2 className="text-3xl md:text-5xl font-black tracking-[-.045em] mt-3">ثلاثة أبواب. ولا شاشة تربكك.</h2></div>
          <div className="journey-grid mt-10">{journey.map((item) => <Journey key={item.title} {...item} />)}</div>
          <div className="understanding-flow mt-12"><Flow icon={UploadCloud} n="1" title="ارفع" text="التكليف أو المسودة" /><Flow icon={FilePenLine} n="2" title="ابنِ" text="قسماً واضحاً كل مرة" /><Flow icon={FileSearch} n="3" title="افحص" text="المصادر والترابط" /><Flow icon={MessageCircleQuestion} n="4" title="ناقش" text="أسئلة من مشروعك نفسه" /></div>
        </section>

        <section className="public-xray-section border-y hairline">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-16 grid lg:grid-cols-2 gap-10 items-center">
            <div className="xray-visual panel">
              <div className="flex items-center justify-between"><span className="eyebrow">Project X-Ray</span><span className="quality-badge">جاهز 86%</span></div>
              <div className="xray-score-grid mt-7"><Score value="91" label="الهيكل" /><Score value="78" label="المصادر" /><Score value="88" label="الترابط" /></div>
              <div className="xray-finding mt-6"><Check size={16} /> الحجة واضحة ومتسلسلة</div>
              <div className="xray-finding xray-finding--warn"><FileSearch size={16} /> فقرتان تحتاجان مصدراً موثوقاً</div>
            </div>
            <div>
              <div className="eyebrow brand-text">الميزة التي تحميك</div><h2 className="text-3xl md:text-5xl font-black tracking-[-.045em] mt-3">لا تستلم ملفاً وتضيع.</h2>
              <p className="body-copy text-base mt-5">كل قسم قابل للشرح والتبسيط والتوسيع، وكل معلومة غير موثقة تظهر أمامك. وبعدها يولّد لك النظام أسئلة من مشروعك نفسه حتى تدخل المناقشة وأنت فاهم.</p>
              <ul className="feature-check-list mt-6"><li><ShieldCheck size={18} /> لا اختلاق لمراجع أو بيانات.</li><li><Sparkles size={18} /> بنية وأمثلة وإيقاع مختلف لكل طالب.</li><li><BookOpenCheck size={18} /> سجل نسخ يحفظ كل تعديل.</li></ul>
            </div>
          </div>
        </section>

        <section id="pricing" className="max-w-7xl mx-auto px-4 md:px-8 py-16 md:py-24">
          <div className="pricing-preview">
            <div><div className="eyebrow">سعر طالب، مو سعر مكتب</div><h2 className="text-3xl md:text-5xl font-black tracking-[-.045em] mt-3">ابدأ مجاناً. المشروع الكامل من 4.900 د.ك.</h2><p className="body-copy mt-4">ادفع للمشروع الذي تحتاجه فقط. لا اشتراك إجباري.</p></div>
            <div className="price-orbit"><span className="price-orbit__amount">4.900</span><span className="price-orbit__currency">د.ك / مشروع</span><Button asChild className="mt-5"><Link to="/login">شاهد الباقات</Link></Button></div>
          </div>
        </section>

        <section id="teacher" className="teacher-lite-strip">
          <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-start gap-4"><span className="h-12 w-12 rounded-2xl bg-white/12 grid place-items-center shrink-0"><GraduationCap size={23} /></span><div><div className="eyebrow text-white/65">Teacher Lite · اختياري</div><h2 className="text-2xl font-bold mt-1">سياسة واضحة ورابط تحقق. بلا نظام جامعي ثقيل.</h2></div></div>
            <Button variant="outline" asChild className="bg-white text-slate-950 border-white"><Link to="/login">دخول المعلم</Link></Button>
          </div>
        </section>
      </main>

      <footer className="px-4 md:px-8 py-8"><div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 justify-between text-xs muted"><span>AcademicOS — اكتب، افهم، ناقش.</span><span className="flex flex-wrap gap-x-4"><Link className="min-h-11 inline-flex items-center" to="/p/academic-integrity">النزاهة</Link><Link className="min-h-11 inline-flex items-center" to="/p/privacy">الخصوصية</Link><Link className="min-h-11 inline-flex items-center" to="/p/terms">الشروط</Link><Link className="min-h-11 inline-flex items-center" to="/p/faq">الأسئلة</Link></span></div></footer>
    </div>
  );
}

function Proof({ icon: Icon, label }: { icon: React.ElementType; label: string }) { return <div className="proof-mini"><Icon size={17} /><span>{label}</span></div>; }
function Journey({ icon: Icon, title, text, to, tone }: { icon: React.ElementType; title: string; text: string; to: string; tone: string }) { return <Link to={to} className={`journey-card journey-card--${tone} focus-ring`}><span className="journey-card__icon"><Icon size={26} /></span><div><h3>{title}</h3><p>{text}</p></div><ArrowLeft size={20} className="journey-card__arrow" /></Link>; }
function Flow({ icon: Icon, n, title, text }: { icon: React.ElementType; n: string; title: string; text: string }) { return <div className="understanding-step"><span className="understanding-step__number">{n}</span><Icon size={23} /><strong>{title}</strong><small>{text}</small></div>; }
function Score({ value, label }: { value: string; label: string }) { return <div className="xray-score"><strong>{value}</strong><span>{label}</span></div>; }
