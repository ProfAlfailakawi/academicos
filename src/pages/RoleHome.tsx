import React from 'react';
import { Link } from 'react-router';
import { ArrowRight, BookOpenCheck, Building2, CircleHelp, CreditCard, GraduationCap, Landmark, Scale, Search, ShieldCheck, Sparkles, Target, UsersRound, type LucideIcon } from 'lucide-react';
import { api } from '../lib/api';
import type { UserProfile } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../lib/i18n';
import { PageHeader } from '../components/PageHeader';
import { Card, CardContent } from '../components/ui/card';
import type { UserRole } from '../types';

type Mission={title:string;detail:string;to:string;icon:LucideIcon;tone:'brand'|'blue'|'amber'};
const M={
  faculty:{title:'rolehome.mission.faculty.title',detail:'rolehome.mission.faculty.detail',to:'/app/professor',icon:GraduationCap,tone:'brand'},
  control:{title:'rolehome.mission.control.title',detail:'rolehome.mission.control.detail',to:'/app/control',icon:Building2,tone:'blue'},
  curriculum:{title:'rolehome.mission.curriculum.title',detail:'rolehome.mission.curriculum.detail',to:'/app/curriculum-twin',icon:BookOpenCheck,tone:'amber'},
  platform:{title:'rolehome.mission.platform.title',detail:'rolehome.mission.platform.detail',to:'/app/platform',icon:Landmark,tone:'brand'},
  users:{title:'rolehome.mission.users.title',detail:'rolehome.mission.users.detail',to:'/app/users',icon:UsersRound,tone:'blue'},
  support:{title:'rolehome.mission.support.title',detail:'rolehome.mission.support.detail',to:'/app/support-console',icon:CircleHelp,tone:'amber'},
  help:{title:'rolehome.mission.help.title',detail:'rolehome.mission.help.detail',to:'/app/support',icon:CircleHelp,tone:'amber'},
  search:{title:'rolehome.mission.search.title',detail:'rolehome.mission.search.detail',to:'/app/search',icon:Search,tone:'brand'},
  trust:{title:'rolehome.mission.trust.title',detail:'rolehome.mission.trust.detail',to:'/app/platform',icon:ShieldCheck,tone:'blue'},
  finance:{title:'rolehome.mission.finance.title',detail:'rolehome.mission.finance.detail',to:'/app/platform',icon:CreditCard,tone:'amber'},
} satisfies Record<string,Mission>;

const roleMissions:Record<UserRole,Mission[]>={
  student:[],student_group_leader:[],teaching_assistant:[M.search,M.help],professor:[M.faculty,M.search],course_coordinator:[M.faculty,M.search],department_admin:[M.control,M.curriculum,M.search],college_admin:[M.control,M.curriculum,M.search],university_admin:[M.control,M.users,M.platform],ai_governance_officer:[M.control,M.curriculum,M.search],accreditation_officer:[M.curriculum,M.control,M.search],national_admin:[M.control,M.curriculum,M.platform],employer:[M.search,M.help],support_agent:[M.support,M.search,M.help],finance_admin:[M.finance,M.platform,M.search],trust_safety_admin:[M.trust,M.support,M.platform],admin:[M.control,M.users,M.platform],superadmin:[M.control,M.users,M.platform],root_owner:[M.control,M.users,M.platform],
};
const labels:Partial<Record<UserRole,string>>={teaching_assistant:'rolehome.role.teaching_assistant',professor:'rolehome.role.professor',course_coordinator:'rolehome.role.course_coordinator',department_admin:'rolehome.role.department_admin',college_admin:'rolehome.role.college_admin',university_admin:'rolehome.role.university_admin',ai_governance_officer:'rolehome.role.ai_governance_officer',accreditation_officer:'rolehome.role.accreditation_officer',national_admin:'rolehome.role.national_admin',employer:'rolehome.role.employer',support_agent:'rolehome.role.support_agent',finance_admin:'rolehome.role.finance_admin',trust_safety_admin:'rolehome.role.trust_safety_admin',admin:'rolehome.role.admin',superadmin:'rolehome.role.superadmin',root_owner:'rolehome.role.root_owner'};

export function RoleHome(){
  const{user}=useAuth();const{t}=useI18n();const missions=roleMissions[user?.role||'student'];
  // Faculty and admins had no way into the onboarding wizard at all. This is a
  // single quiet row, not a redirect: it appears only while the profile is
  // unfinished, and a failed profile call simply leaves it hidden.
  const[profile,setProfile]=React.useState<UserProfile|null>(null);
  React.useEffect(()=>{let active=true;api.profile().then((r)=>{if(active)setProfile(r.profile);}).catch(()=>{});return()=>{active=false;};},[]);
  const showOnboarding=Boolean(profile)&&!profile?.onboardingCompleted;
  const roleLabel=(r:UserRole)=>{const k=labels[r];return k?t(k):'';};
  const greetingName=user?.displayName?.replace(/\s*\([^)]*\)\s*/g,' ').trim()||roleLabel(user?.role||'student')||'';
  return <div className="space-y-7">
    <PageHeader eyebrow={t('rolehome.eyebrow')} title={`${t('rolehome.greeting')} ${greetingName}`} description={`${t('rolehome.spacePrefix')} ${roleLabel(user?.role||'student')||t('rolehome.spaceFallback')} ${t('rolehome.spaceSuffix')}`}/>
    <section aria-labelledby="next-actions"><div className="flex items-center gap-2 mb-3"><Sparkles size={17} className="brand-text"/><h2 id="next-actions" className="section-title">{t('rolehome.nextStep')}</h2></div><div className="grid md:grid-cols-3 gap-4">{missions.map((mission,index)=>{const Icon=mission.icon;return <Link key={mission.title} to={mission.to} className="group focus-ring rounded-2xl"><Card className="h-full transition-transform group-hover:-translate-y-0.5"><CardContent><div className="flex items-start justify-between gap-3"><span className={`h-12 w-12 rounded-2xl grid place-items-center ${mission.tone==='amber'?'bg-warning/12 text-warning':mission.tone==='blue'?'bg-info/12 text-info':'brand-soft-bg brand-text'}`}><Icon size={21}/></span><span className="eyebrow">0{index+1}</span></div><h3 className="text-base font-semibold mt-5">{t(mission.title)}</h3><p className="body-copy mt-2">{t(mission.detail)}</p><div className="mt-5 flex items-center gap-2 text-xs font-semibold brand-text">{t('rolehome.openSpace')}<ArrowRight size={14} className="directional-icon"/></div></CardContent></Card></Link>})}</div></section>
    {showOnboarding&&<Card className="onboarding-invite relative overflow-hidden"><CardContent className="relative flex flex-col sm:flex-row sm:items-center gap-4"><span aria-hidden="true" className="onboarding-invite__wash pointer-events-none absolute inset-0"/><span className="relative h-11 w-11 shrink-0 rounded-xl brand-soft-bg brand-text grid place-items-center"><Target size={19}/></span><div className="relative flex-1 min-w-0"><h2 className="section-title">{t('mission.profileInviteTitle')}</h2><p className="body-copy mt-1">{t('mission.profileInviteDesc')}</p></div><Link to="/app/onboarding" className="relative focus-ring min-h-11 shrink-0 rounded-xl brand-bg px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold">{t('mission.profileInviteCta')}<ArrowRight size={15} className="directional-icon"/></Link></CardContent></Card>}
    <Card><CardContent className="flex flex-col sm:flex-row sm:items-center gap-4"><span className="h-11 w-11 rounded-xl bg-success/12 text-success grid place-items-center"><Scale size={19}/></span><div className="flex-1"><h2 className="section-title">{t('rolehome.safeRule.title')}</h2><p className="body-copy mt-1">{t('rolehome.safeRule.detail')}</p></div><Link to="/app/search" className="focus-ring min-h-11 rounded-xl border hairline px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold"><Search size={16}/>{t('rolehome.unifiedSearch')}</Link></CardContent></Card>
  </div>;
}
