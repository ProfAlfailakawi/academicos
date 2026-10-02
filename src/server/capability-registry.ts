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
  C('enrollments','academic','التسجيلات','ربط المستخدمين بالمقررات والأقسام ضمن النطاق المؤسسي.',['pending','active','withdrawn','completed'],['userId','courseId','sectionId','role']),
  C('affiliations','institution','الانتساب المؤسسي','إثباتات انتساب الطالب أو عضو هيئة التدريس.',['pending','verified','rejected','expired'],['userId','institutionId','method','verifiedAt']),
  C('institutionDirectory','institution','الدليل المؤسسي','دليل أكاديمي قابل للبحث ضمن الصلاحيات.',['active','hidden'],['userId','departmentId','title','visibility']),
  C('templates','academic','مكتبة القوالب','قوالب التكليفات ومعايير التقييم والمقررات ومساحات العمل بإصدارات ثابتة.',['draft','published','archived'],['kind','content','scope']),
  C('templateVersions','academic','إصدارات القوالب','نسخ غير قابلة للتعديل مرتبطة بالاستخدام التاريخي.',['published','superseded'],['templateId','version','snapshot']),
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
  C('deletionRequests','lifecycle','طلبات الحذف','سير عمل قابل للتدقيق للحذف أو إخفاء الهوية والقيود المؤسسية.',['requested','grace_period','blocked_by_retention','approved','processing','completed','cancelled'],['scope','graceEndsAt','exportRequested','retentionReason'],{sensitive:true}),
  C('recycleBin','lifecycle','سلة المحذوفات','سجل الاستعادة للعناصر المحذوفة منطقيًا.',['deleted','restored','purged'],['resource','recordId','purgeAt']),
  C('aiModels','ai','نماذج AI','الأسماء المستعارة والقدرات والتكلفة وأولوية التبديل الاحتياطي والخصوصية.',['active','disabled','retiring'],['provider','alias','capabilities','allowedTasks','privacyClass','fallbackPriority'],{sensitive:true}),
  C('aiPrompts','ai','إدارة التعليمات','تعليمات بإصدارات واختبارات وإمكانية التراجع.',['draft','active','retired'],['promptId','version','tags','content','testSuiteId'],{sensitive:true}),
  C('aiEvaluations','ai','تقييمات AI','نتائج اختبارات الاستخراج والهلوسة ومعايير التقييم.',['queued','running','passed','failed'],['suite','modelAlias','promptVersion','metrics']),
  C('aiRoutingPolicies','ai','سياسة التوجيه','اختيار النموذج حسب المخاطر والتعقيد والتكلفة والخصوصية.',['draft','active'],['task','risk','qualityFloor','budgetClass','providerAllowlist'],{sensitive:true}),
  C('aiBudgets','ai','ميزانية AI','الحدود المرنة والصارمة والاستخدام العادل ومسبح المؤسسة.',['active','paused'],['plan','monthlyBudget','softLimit','hardLimit','premiumCapacity']),
  C('aiAuditSamples','ai','عينات تدقيق AI','عينات مراجعة جودة وسياسة بدون تخزين سلسلة التفكير.',['queued','reviewed','escalated'],['runId','reason','reviewer','finding'],{sensitive:true}),
  C('integrationConfigs','integrations','إعدادات التكامل','إعدادات غير سرية للموصلات وحالة الربط.',['disabled','configured','connected','error'],['provider','scopes','syncMode','credentialRef'],{external:true,sensitive:true}),
  C('lmsConfigs','integrations','LMS','Canvas/Moodle/Blackboard/D2L وإعدادات المزامنة.',['disabled','configured','connected','error'],['provider','baseUrl','scopes','syncMode'],{external:true,sensitive:true}),
  C('ssoConfigs','integrations','SSO','SAML/OIDC والنطاقات وسياسة التهيئة التلقائية للحسابات.',['disabled','configured','connected','error'],['provider','issuer','domain','provisioningMode'],{external:true,sensitive:true}),
  C('emailConfigs','integrations','البريد التشغيلي','مزود البريد وقواعد الإرسال دون تخزين سر خام.',['disabled','configured','connected','error'],['provider','sender','credentialEnvKey'],{external:true,sensitive:true}),
  C('emailTemplates','integrations','قوالب البريد','قوالب الرسائل التشغيلية منفصلة عن الرسائل التسويقية.',['draft','active','archived'],['key','subject','body','category']),
  C('emailPreferences','integrations','تفضيلات البريد','Opt-in/critical/marketing preferences.',['active'],['userId','critical','academic','marketing']),
  C('externalTools','integrations','الأدوات الخارجية','تعريف الأدوات وسياسات الاستدعاء والتدقيق.',['disabled','configured','active','error'],['name','kind','endpoint','credentialEnvKey'],{external:true,sensitive:true}),
  C('externalToolPolicies','integrations','سياسات الأدوات','النطاقات والحدود والموافقة البشرية قبل الإجراءات الحساسة.',['draft','active'],['toolId','allowedActions','approvalRequired','dataBoundary']),
  C('webhooks','integrations','Webhooks','اشتراكات أحداث موقعة HMAC مع سر عبر مرجع متغير بيئة.',['active','paused'],['url','events','signingSecretEnvKey'],{external:true,sensitive:true}),
  C('courseImports','integrations','استيراد المقررات','طلبات استيراد المقررات والتسجيلات والتكليفات ومعايير التقييم.',['queued','running','completed','failed'],['provider','externalCourseId','mode'],{external:true}),
  C('gradeImports','integrations','استيراد الدرجات','استيراد مُراجع ومقيد بالصلاحيات مع التتبّع.',['queued','needs_review','completed','failed'],['provider','courseId','sourceRef'],{external:true,sensitive:true}),
  C('semanticIndexes','academic','الفهرس الدلالي','فهرسة ضمن النطاق المؤسسي والمشروع لمصادر وملفات الاسترجاع المعزّز (RAG).',['queued','ready','stale','failed'],['scope','projectId','provider','documentCount'],{external:true,sensitive:true}),
  C('researchSources','academic','مدير المراجع','مصادر موثقة، جودة، تعارض وأثر استخدامها.',['inbox','reading','verified','rejected'],['title','url','doi','authors','year','quality','verification']),
  C('referenceLibrary','academic','المكتبة المرجعية','مواد ومصادر مشتركة ضمن صلاحيات المؤسسة.',['active','archived'],['type','source','tags','visibility']),
  C('submissionAttempts','academic','محاولات التسليم','لقطات ومحاولات متعددة دون الكتابة فوق التاريخ.',['draft','submitted','returned','accepted'],['projectId','attemptNumber','snapshotRef','submittedAt']),
  C('credentials','network','الشهادات الموثقة','سجلات شهادات قابلة للتحقق والمشاركة بالموافقة.',['draft','issued','revoked','expired'],['subjectUserId','type','issuer','evidenceIds','verificationCode']),
  C('credentialPolicies','network','سياسات الشهادات','شروط الإصدار والمراجعة والانتهاء.',['draft','active'],['type','humanApproval','expiresInDays','evidenceRequirements']),
  C('portfolioItems','network','عناصر ملف الإنجاز','مشاريع وأدلة مختارة يملك المستخدم قرار نشرها.',['private','institution','shared','public'],['ownerId','kind','targetId','summary']),
  C('portfolioPolicies','network','خصوصية ملف الإنجاز','قواعد المشاركة والفهرسة وحق الرجوع.',['active'],['defaultVisibility','indexingAllowed','watermark']),
  C('challenges','network','شبكة التحديات','مشكلات ومجموعات بيانات ومخرجات من جهات خارجية.',['draft','review','published','closed','rejected'],['organization','brief','eligibility','deadline','skills']),
  C('challengePolicies','network','حوكمة التحديات','أخلاقيات والملكية الفكرية والإشراف وسياسة بيانات التحديات.',['draft','active'],['moderation','ipTerms','dataUse','studentConsent']),
  C('marketplaceItems','network','Marketplace','قوالب/مهارات مستقبلية خلف مفتاح ميزة.',['draft','review','published','suspended'],['creatorId','category','license','price']),
  C('marketplacePolicies','network','حوكمة السوق','الإشراف والحقوق والترخيص وسياسة الاسترداد.',['draft','active'],['moderation','licenses','refunds']),
  C('nationalFrameworks','network','الأطر الوطنية','أطر وطنية وربطها بالمخرجات والمهارات.',['draft','active','superseded'],['name','version','outcomes','minimumCohortSize']),
  C('accreditationSnapshots','governance','لقطات الاعتماد','لقطة تاريخية للأدلة والربط وقت المراجعة.',['draft','locked','exported'],['programId','period','evidenceRefs','lockedAt']),
  C('outcomeSamples','governance','عينات المخرجات','أخذ عينات من الأدلة للاعتماد دون اختلاق أدلة.',['draft','reviewed','accepted'],['programOutcomeId','sampleRefs','method']),
  C('institutionBenchmarks','network','المقارنات المؤسسية','مقارنات مجمّعة مع حدّ أدنى لحجم المجموعة وخصوصية.',['draft','published'],['metric','cohortThreshold','period','aggregation']),
  C('curriculumMaps','governance','خرائط المنهج','Program Outcome → Course → Assignment → Criterion → Evidence.',['draft','active','archived'],['programId','nodes','edges']),
  C('contracts','commercial','العقود المؤسسية','بيانات استحقاق العقد دون تخزين أسرار دفع.',['draft','active','expired','terminated'],['institutionId','startsAt','endsAt','billingModel','entitlementSetId'],{sensitive:true}),
  C('entitlements','commercial','الاستحقاقات','الميزات والحدود تُقرأ من البيانات ولا تُكتب في الكود.',['active','inactive'],['plan','features','limits','aiBudgetId']),
  C('licenses','commercial','التراخيص','Seat/site/national license expiry and grace policy.',['active','grace','expired','cancelled'],['contractId','seatLimit','expiresAt','graceEndsAt']),
  C('seatAssignments','commercial','المقاعد','تخصيص المقاعد وتتبع الاستهلاك.',['invited','active','released'],['licenseId','userId','assignedAt']),
  C('subscriptions','commercial','الاشتراكات','دورة الاشتراك وحالة الوصول.',['trialing','active','past_due','grace','cancelled','expired'],['userId','plan','providerRef','currentPeriodEnd'],{sensitive:true}),
  C('transactions','commercial','المعاملات','المدفوعات والمبالغ المستردة وبيانات النزاعات.',['pending','paid','failed','refunded','chargeback'],['provider','amount','currency','externalId'],{sensitive:true}),
  C('fraudRules','commercial','ضوابط الاحتيال','إشارات وحدود التجارب والمدفوعات المريبة.',['active','inactive'],['signal','threshold','action'],{sensitive:true}),
  C('profitGuardrails','commercial','ضوابط التكلفة','حدود تكلفة الذكاء الاصطناعي بصورة تدريجية حسب الخطة.',['active','inactive'],['plan','maxAiCost','softAction','hardAction']),
  C('salesLeads','commercial','مبيعات المؤسسات','ربط داخلي بنظام إدارة العملاء أو مُحوّل مزامنة عند توافر المزود.',['new','qualified','proposal','won','lost'],['organization','contactRef','stage','externalCrmRef'],{sensitive:true}),
  C('slaPolicies','commercial','SLA','أهداف الخدمة والدعم والعقود.',['draft','active','expired'],['tier','availabilityTarget','responseTargets']),
  C('supportEntitlements','commercial','الدعم المخصص','مستوى الدعم والتصعيد لكل عقد.',['active','expired'],['contractId','tier','channels','hours']),
  C('securityReports','trust','تقارير الأمن','الإفصاح المسؤول وبلاغات المستخدمين مع الفرز.',['open','triage','investigating','resolved','closed'],['category','severity','summary','contact'],{sensitive:true}),
  C('securityAlerts','trust','تنبيهات الأمن','تنبيهات تسجيل الدخول والجلسات وتغييرات MFA.',['queued','sent','acknowledged','failed'],['userId','type','channel','occurredAt'],{sensitive:true}),
  C('securityEventsConfig','trust','تصنيف أحداث الأمن','Severity/routing/retention controls.',['active','inactive'],['eventType','severity','notifyRoles','retentionDays'],{sensitive:true}),
  C('serviceIncidents','trust','حالة الخدمة','الخط الزمني للحوادث للعرض داخل المنتج أو في صفحة الحالة.',['investigating','identified','monitoring','resolved'],['severity','components','message','startedAt','resolvedAt']),
  C('domainClaims','trust','مطالبات النطاق','إثبات ملكية نطاق البريد قبل الربط بالمؤسسة.',['pending','verified','rejected','expired'],['domain','verificationMethod','verificationRef'],{sensitive:true}),
  C('institutionVerifications','trust','توثيق المؤسسات','سجل مراجعة المؤسسة والعقد والنطاق.',['pending','verified','rejected','suspended'],['institutionId','method','reviewerId','evidenceRef'],{sensitive:true}),
  C('userReports','trust','بلاغات المستخدم','الملاحظات وإساءة الاستخدام والمخالفات الأكاديمية مع سير عمل.',['open','triage','resolved','closed'],['type','targetRef','summary'],{sensitive:true}),
  C('institutionFeedback','governance','ملاحظات المؤسسة','ملاحظات مرتبطة بالإصدار والميزة.',['new','reviewed','planned','closed'],['feature','summary','priority']),
  C('publicTrustIndicators','trust','مؤشرات الثقة العامة','تعريف المؤشرات التي يمكن نشرها دون كشف بيانات خاصة.',['draft','published'],['key','value','source','verifiedAt']),
  C('ipPolicies','governance','حقوق الملكية الفكرية','سياسات الملكية الفكرية للمشاريع والتحديات والمحتوى المولَّد بالذكاء الاصطناعي.',['draft','active'],['scope','studentOwnership','challengeTerms','aiGeneratedTerms']),
  C('systemConfig','governance','إعدادات النظام','الصيانة والقراءة فقط والإعدادات الافتراضية والحدود ضمن سجل التدقيق.',['active'],['maintenanceMode','readOnlyMode','uploadLimits','allowedCountries'],{sensitive:true}),
  C('notificationRules','governance','قواعد التنبيه','الأولويات وساعات الهدوء وتنبيهات الطلاب المعرّضين للخطر وسياسة تقليل الإزعاج.',['active','inactive'],['event','priority','audience','quietHours']),
  C('announcements','institution','الإعلانات','إعلانات الجامعة والطلبة باستهداف واضح.',['draft','scheduled','published','expired'],['message','audience','roles','courseIds','publishAt','expiresAt']),
  C('announcementsAudit','trust','تدقيق الإعلانات','تدقيق مجمّع للتسليم والقراءة بدون تسريب فردي غير لازم.',['recorded'],['announcementId','channel','audienceCount','deliveredCount']),
  C('dataExports','lifecycle','تصدير البيانات','طلبات تصدير فردية أو ضمن النطاق المؤسسي حسب الصلاحية.',['requested','processing','ready','expired','failed'],['scope','format','requestedBy','expiresAt'],{sensitive:true}),
];

export const platformCapability = (resource:PlatformResourceKey) => PLATFORM_CAPABILITIES.find(x=>x.resource===resource);
