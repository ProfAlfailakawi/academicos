import type { PlatformResourceKey, UserRole } from '../types';

export type PlatformCapabilityCategory = 'institution'|'academic'|'governance'|'ai'|'integrations'|'lifecycle'|'commercial'|'trust'|'network';

export interface PlatformCapabilityDefinition {
  resource: PlatformResourceKey;
  category: PlatformCapabilityCategory;
  label: string;
  description: string;
  statusValues: string[];
  suggestedFields: string[];
  external?: boolean;
  sensitive?: boolean;
  readRoles?: UserRole[];
  writeRoles?: UserRole[];
}

const C = (resource:PlatformResourceKey,category:PlatformCapabilityCategory,label:string,description:string,statusValues:string[]=['active','inactive'],suggestedFields:string[]=[],extra:Partial<PlatformCapabilityDefinition>={}):PlatformCapabilityDefinition => ({resource,category,label,description,statusValues,suggestedFields,...extra});

export const PLATFORM_CAPABILITIES:PlatformCapabilityDefinition[] = [
  C('institutions','institution','المؤسسات','إدارة ملف المؤسسة والنطاق والهوية والخصائص.',['active','pending_verification','suspended'],['name','country','domain','region']),
  C('campuses','institution','الحُرُم الجامعية','مواقع المؤسسة ونطاقاتها الأكاديمية.',['active','inactive'],['name','code','timezone']),
  C('departments','institution','الأقسام','هيكل الأقسام والربط بالبرامج.',['active','archived'],['name','code','collegeId']),
  C('programs','institution','البرامج','البرامج والمخرجات الأكاديمية.',['active','archived'],['name','code','departmentId','outcomes']),
  C('academicTerms','academic','الفصول والفترات','التقويم الأكاديمي وفترات الاختبارات والعطل.',['draft','active','closed'],['name','startDate','endDate','examStart','examEnd','timezone']),
  C('semesterTemplates','academic','قوالب الفصول','قوالب قابلة لإعادة الاستخدام للفصول الدراسية.',['draft','active','archived'],['name','milestones','holidays']),
  C('enrollments','academic','التسجيلات','ربط المستخدمين بالمقررات والأقسام ضمن الـTenant.',['pending','active','withdrawn','completed'],['userId','courseId','sectionId','role']),
  C('affiliations','institution','الانتساب المؤسسي','إثباتات انتساب الطالب أو عضو هيئة التدريس.',['pending','verified','rejected','expired'],['userId','institutionId','method','verifiedAt']),
  C('institutionDirectory','institution','الدليل المؤسسي','دليل أكاديمي قابل للبحث ضمن الصلاحيات.',['active','hidden'],['userId','departmentId','title','visibility']),
  C('templates','academic','مكتبة القوالب','قوالب Assignment/Rubric/Course/Workspace بإصدارات ثابتة.',['draft','published','archived'],['kind','content','scope']),
  C('templateVersions','academic','إصدارات القوالب','نسخ immutable مرتبطة بالاستخدام التاريخي.',['published','superseded'],['templateId','version','snapshot']),
  C('regionalAcademicStyles','academic','الأنماط الأكاديمية الإقليمية','مصطلحات وتنسيقات وتفضيلات أكاديمية حسب المنطقة.',['active','inactive'],['locale','citationDefaults','terminology']),
  C('gradingScales','academic','سلالم الدرجات','تعريف سلالم قابلة للتخصيص دون افتراض نظام عالمي واحد.',['active','archived'],['name','bands','locale']),
  C('accommodations','academic','التسهيلات','تسهيلات أكاديمية بصلاحيات وخصوصية مناسبة.',['active','expired'],['userId','type','scope','expiresAt'],{sensitive:true}),
  C('alternativeDeadlines','academic','المواعيد البديلة','استثناءات مواعيد تسليم موثقة دون تغيير الأصل.',['approved','pending','rejected','expired'],['userId','assignmentId','deadline','reason'],{sensitive:true}),
  C('knowledgeBase','governance','قاعدة معرفة الإدارة','مواد مساعدة داخلية وإرشادات تشغيلية.',['draft','published','archived'],['audience','content','tags']),
  C('organizationKnowledge','governance','معرفة المؤسسة','سياسات وإرشادات ومرجعيات المؤسسة القابلة للاسترجاع.',['draft','published','archived'],['scope','content','source']),
  C('brandConfig','institution','الهوية البيضاء','الشعار والألوان والمصطلحات وصفحات المؤسسة.',['active','inactive'],['institutionName','logoUrl','primaryColor','accentColor','supportEmail','footer']),
  C('currencySettings','commercial','العملة','عملات العرض والعقود والتنسيق المحلي.',['active','inactive'],['currency','locale','taxMode']),
  C('dataResidencyPolicies','governance','إقامة البيانات','سياسات المنطقة والاستضافة المخصصة والبوابة الخاصة.',['draft','active'],['region','hostingMode','sovereignRequired','privateAiGateway'],{external:true,sensitive:true}),
  C('minorUserPolicies','governance','سياسة العمر','قيود العمر والموافقات عند تمكين مستخدمين دون السن.',['draft','active'],['minimumAge','parentalConsent','institutionConsent']),
  C('privacyPolicies','governance','سياسات الخصوصية','الاحتفاظ والمشاركة والموافقة وحدود التحليلات.',['draft','active','superseded'],['retentionDays','analyticsMode','sharingDefaults']),
  C('retentionPolicies','lifecycle','الاحتفاظ','قواعد الاحتفاظ بعد التخرج أو انتهاء العقد.',['draft','active'],['scope','days','graduationMode','institutionOverride']),
  C('backupPolicies','lifecycle','سياسات النسخ الاحتياطي','إعدادات النسخ والاستعادة واختبارات التعافي.',['draft','active'],['frequency','retention','restoreTestFrequency','workerProfile'],{external:true,sensitive:true}),
  C('backupRuns','lifecycle','عمليات النسخ','سجل طلبات ونتائج النسخ والاستعادة.',['queued','running','completed','failed','cancelled'],['kind','scope','providerRef'],{external:true,sensitive:true}),
  C('migrationRuns','lifecycle','الهجرات','هجرات مخطط البيانات مع سجل وتوافق خلفي.',['queued','running','completed','failed','cancelled'],['migrationId','fromVersion','toVersion']),
  C('rolloverRuns','lifecycle','ترحيل السنة الأكاديمية','نسخ البنية الأكاديمية دون تعديل السجل التاريخي.',['queued','running','completed','failed'],['fromTermId','toTermId','cloneCourses','cloneTemplates']),
  C('deletionRequests','lifecycle','طلبات الحذف','Workflow قابل للتدقيق للحذف أو إخفاء الهوية والقيود المؤسسية.',['requested','grace_period','blocked_by_retention','approved','processing','completed','cancelled'],['scope','graceEndsAt','exportRequested','retentionReason'],{sensitive:true}),
  C('recycleBin','lifecycle','سلة المحذوفات','سجل الاستعادة للعناصر المحذوفة منطقيًا.',['deleted','restored','purged'],['resource','recordId','purgeAt']),
  C('aiModels','ai','نماذج AI','Aliases وقدرات وتكلفة وأولوية fallback وخصوصية.',['active','disabled','retiring'],['provider','alias','capabilities','allowedTasks','privacyClass','fallbackPriority'],{sensitive:true}),
  C('aiPrompts','ai','إدارة Prompts','Prompts بإصدارات واختبارات وإمكانية rollback.',['draft','active','retired'],['promptId','version','tags','content','testSuiteId'],{sensitive:true}),
  C('aiEvaluations','ai','تقييمات AI','نتائج اختبارات الاستخراج والهلوسة والـRubric.',['queued','running','passed','failed'],['suite','modelAlias','promptVersion','metrics']),
  C('aiRoutingPolicies','ai','سياسة التوجيه','اختيار النموذج حسب المخاطر والتعقيد والتكلفة والخصوصية.',['draft','active'],['task','risk','qualityFloor','budgetClass','providerAllowlist'],{sensitive:true}),
  C('aiBudgets','ai','ميزانية AI','حدود soft/hard والاستخدام العادل ومسبح المؤسسة.',['active','paused'],['plan','monthlyBudget','softLimit','hardLimit','premiumCapacity']),
  C('aiAuditSamples','ai','عينات تدقيق AI','عينات مراجعة جودة وسياسة بدون تخزين chain-of-thought.',['queued','reviewed','escalated'],['runId','reason','reviewer','finding'],{sensitive:true}),
  C('integrationConfigs','integrations','إعدادات التكامل','إعدادات غير سرية للموصلات وحالة الربط.',['disabled','configured','connected','error'],['provider','scopes','syncMode','credentialRef'],{external:true,sensitive:true}),
  C('lmsConfigs','integrations','LMS','Canvas/Moodle/Blackboard/D2L وإعدادات المزامنة.',['disabled','configured','connected','error'],['provider','baseUrl','scopes','syncMode'],{external:true,sensitive:true}),
  C('ssoConfigs','integrations','SSO','SAML/OIDC والـDomains وسياسة provisioning.',['disabled','configured','connected','error'],['provider','issuer','domain','provisioningMode'],{external:true,sensitive:true}),
  C('emailConfigs','integrations','البريد التشغيلي','مزود البريد وقواعد الإرسال دون تخزين Secret خام.',['disabled','configured','connected','error'],['provider','sender','credentialEnvKey'],{external:true,sensitive:true}),
  C('emailTemplates','integrations','قوالب البريد','قوالب transactional منفصلة عن marketing.',['draft','active','archived'],['key','subject','body','category']),
  C('emailPreferences','integrations','تفضيلات البريد','Opt-in/critical/marketing preferences.',['active'],['userId','critical','academic','marketing']),
  C('externalTools','integrations','الأدوات الخارجية','تعريف الأدوات وسياسات الاستدعاء والتدقيق.',['disabled','configured','active','error'],['name','kind','endpoint','credentialEnvKey'],{external:true,sensitive:true}),
  C('externalToolPolicies','integrations','سياسات الأدوات','Scopes والحدود والموافقة البشرية قبل actions الحساسة.',['draft','active'],['toolId','allowedActions','approvalRequired','dataBoundary']),
  C('webhooks','integrations','Webhooks','اشتراكات أحداث موقعة HMAC مع Secret عبر environment reference.',['active','paused'],['url','events','signingSecretEnvKey'],{external:true,sensitive:true}),
  C('courseImports','integrations','استيراد المقررات','طلبات استيراد Courses/Enrollments/Assignments/Rubrics.',['queued','running','completed','failed'],['provider','externalCourseId','mode'],{external:true}),
  C('gradeImports','integrations','استيراد الدرجات','Import مُراجع ومقيد بالصلاحيات مع traceability.',['queued','needs_review','completed','failed'],['provider','courseId','sourceRef'],{external:true,sensitive:true}),
  C('semanticIndexes','academic','الفهرس الدلالي','فهرسة tenant/project scoped لمصادر وملفات RAG.',['queued','ready','stale','failed'],['scope','projectId','provider','documentCount'],{external:true,sensitive:true}),
  C('researchSources','academic','مدير المراجع','مصادر موثقة، جودة، تعارض وأثر استخدامها.',['inbox','reading','verified','rejected'],['title','url','doi','authors','year','quality','verification']),
  C('referenceLibrary','academic','المكتبة المرجعية','مواد ومصادر مشتركة ضمن صلاحيات المؤسسة.',['active','archived'],['type','source','tags','visibility']),
  C('submissionAttempts','academic','محاولات التسليم','Snapshots ومحاولات متعددة دون الكتابة فوق التاريخ.',['draft','submitted','returned','accepted'],['projectId','attemptNumber','snapshotRef','submittedAt']),
  C('credentials','network','الشهادات الموثقة','Credential records قابلة للتحقق والمشاركة بالموافقة.',['draft','issued','revoked','expired'],['subjectUserId','type','issuer','evidenceIds','verificationCode']),
  C('credentialPolicies','network','سياسات الشهادات','شروط الإصدار والمراجعة والانتهاء.',['draft','active'],['type','humanApproval','expiresInDays','evidenceRequirements']),
  C('portfolioItems','network','عناصر Portfolio','مشاريع وأدلة مختارة يملك المستخدم قرار نشرها.',['private','institution','shared','public'],['ownerId','kind','targetId','summary']),
  C('portfolioPolicies','network','خصوصية Portfolio','قواعد المشاركة والفهرسة وحق الرجوع.',['active'],['defaultVisibility','indexingAllowed','watermark']),
  C('challenges','network','شبكة التحديات','مشكلات وDatasets ومخرجات من جهات خارجية.',['draft','review','published','closed','rejected'],['organization','brief','eligibility','deadline','skills']),
  C('challengePolicies','network','حوكمة التحديات','أخلاقيات وIP وmoderation وسياسة بيانات التحديات.',['draft','active'],['moderation','ipTerms','dataUse','studentConsent']),
  C('marketplaceItems','network','Marketplace','قوالب/مهارات مستقبلية خلف Feature Flag.',['draft','review','published','suspended'],['creatorId','category','license','price']),
  C('marketplacePolicies','network','حوكمة Marketplace','Moderation وحقوق وترخيص وrefund policy.',['draft','active'],['moderation','licenses','refunds']),
  C('nationalFrameworks','network','الأطر الوطنية','Frameworks وطنية وربطها بالمخرجات والمهارات.',['draft','active','superseded'],['name','version','outcomes','minimumCohortSize']),
  C('accreditationSnapshots','governance','لقطات الاعتماد','Snapshot تاريخي للأدلة والربط وقت المراجعة.',['draft','locked','exported'],['programId','period','evidenceRefs','lockedAt']),
  C('outcomeSamples','governance','عينات المخرجات','Evidence sampling للاعتماد دون اختلاق أدلة.',['draft','reviewed','accepted'],['programOutcomeId','sampleRefs','method']),
  C('institutionBenchmarks','network','المقارنات المؤسسية','مقارنات aggregate مع minimum cohort وخصوصية.',['draft','published'],['metric','cohortThreshold','period','aggregation']),
  C('curriculumMaps','governance','خرائط المنهج','Program Outcome → Course → Assignment → Criterion → Evidence.',['draft','active','archived'],['programId','nodes','edges']),
  C('contracts','commercial','العقود المؤسسية','بيانات استحقاق العقد دون تخزين أسرار دفع.',['draft','active','expired','terminated'],['institutionId','startsAt','endsAt','billingModel','entitlementSetId'],{sensitive:true}),
  C('entitlements','commercial','الاستحقاقات','Features/limits من البيانات لا hardcode.',['active','inactive'],['plan','features','limits','aiBudgetId']),
  C('licenses','commercial','التراخيص','Seat/site/national license expiry and grace policy.',['active','grace','expired','cancelled'],['contractId','seatLimit','expiresAt','graceEndsAt']),
  C('seatAssignments','commercial','المقاعد','تخصيص المقاعد وتتبع الاستهلاك.',['invited','active','released'],['licenseId','userId','assignedAt']),
  C('subscriptions','commercial','الاشتراكات','دورة الاشتراك وحالة الوصول.',['trialing','active','past_due','grace','cancelled','expired'],['userId','plan','providerRef','currentPeriodEnd'],{sensitive:true}),
  C('transactions','commercial','المعاملات','مدفوعات/Refunds/chargebacks metadata.',['pending','paid','failed','refunded','chargeback'],['provider','amount','currency','externalId'],{sensitive:true}),
  C('fraudRules','commercial','ضوابط الاحتيال','Signals وحدود التجارب والمدفوعات المريبة.',['active','inactive'],['signal','threshold','action'],{sensitive:true}),
  C('profitGuardrails','commercial','ضوابط التكلفة','حدود AI COGS بصورة graceful حسب الخطة.',['active','inactive'],['plan','maxAiCost','softAction','hardAction']),
  C('salesLeads','commercial','مبيعات المؤسسات','CRM hook داخلي أو sync adapter عند توافر المزود.',['new','qualified','proposal','won','lost'],['organization','contactRef','stage','externalCrmRef'],{sensitive:true}),
  C('slaPolicies','commercial','SLA','أهداف الخدمة والدعم والعقود.',['draft','active','expired'],['tier','availabilityTarget','responseTargets']),
  C('supportEntitlements','commercial','الدعم المخصص','Support tier/escalation لكل عقد.',['active','expired'],['contractId','tier','channels','hours']),
  C('securityReports','trust','تقارير الأمن','Responsible disclosure / user reports مع triage.',['open','triage','investigating','resolved','closed'],['category','severity','summary','contact'],{sensitive:true}),
  C('securityAlerts','trust','تنبيهات الأمن','تنبيهات تسجيل الدخول والجلسات وتغييرات MFA.',['queued','sent','acknowledged','failed'],['userId','type','channel','occurredAt'],{sensitive:true}),
  C('securityEventsConfig','trust','تصنيف أحداث الأمن','Severity/routing/retention controls.',['active','inactive'],['eventType','severity','notifyRoles','retentionDays'],{sensitive:true}),
  C('serviceIncidents','trust','حالة الخدمة','Incident timeline للعرض داخل المنتج/status page.',['investigating','identified','monitoring','resolved'],['severity','components','message','startedAt','resolvedAt']),
  C('domainClaims','trust','مطالبات النطاق','إثبات ملكية نطاق البريد قبل الربط بالمؤسسة.',['pending','verified','rejected','expired'],['domain','verificationMethod','verificationRef'],{sensitive:true}),
  C('institutionVerifications','trust','توثيق المؤسسات','سجل مراجعة المؤسسة والعقد والنطاق.',['pending','verified','rejected','suspended'],['institutionId','method','reviewerId','evidenceRef'],{sensitive:true}),
  C('userReports','trust','بلاغات المستخدم','Feedback/abuse/academic misuse مع workflow.',['open','triage','resolved','closed'],['type','targetRef','summary'],{sensitive:true}),
  C('institutionFeedback','governance','ملاحظات المؤسسة','Feedback مرتبط بالإصدار والميزة.',['new','reviewed','planned','closed'],['feature','summary','priority']),
  C('publicTrustIndicators','trust','مؤشرات الثقة العامة','تعريف المؤشرات التي يمكن نشرها دون كشف بيانات خاصة.',['draft','published'],['key','value','source','verifiedAt']),
  C('ipPolicies','governance','حقوق الملكية الفكرية','سياسات IP للمشاريع والتحديات وAI-generated content.',['draft','active'],['scope','studentOwnership','challengeTerms','aiGeneratedTerms']),
  C('systemConfig','governance','إعدادات النظام','Maintenance/read-only/defaults/limits ضمن audit.',['active'],['maintenanceMode','readOnlyMode','uploadLimits','allowedCountries'],{sensitive:true}),
  C('notificationRules','governance','قواعد التنبيه','Priorities/quiet hours/at-risk notifications وسياسة الإزعاج.',['active','inactive'],['event','priority','audience','quietHours']),
  C('announcements','institution','الإعلانات','إعلانات الجامعة والطلبة باستهداف واضح.',['draft','scheduled','published','expired'],['message','audience','roles','courseIds','publishAt','expiresAt']),
  C('announcementsAudit','trust','تدقيق الإعلانات','Delivery/read audit aggregate بدون تسريب فردي غير لازم.',['recorded'],['announcementId','channel','audienceCount','deliveredCount']),
  C('dataExports','lifecycle','تصدير البيانات','طلبات تصدير فردية أو Tenant-scoped حسب الصلاحية.',['requested','processing','ready','expired','failed'],['scope','format','requestedBy','expiresAt'],{sensitive:true}),
];

export const platformCapability = (resource:PlatformResourceKey) => PLATFORM_CAPABILITIES.find(x=>x.resource===resource);
