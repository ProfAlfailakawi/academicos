import { randomUUID } from "node:crypto";
import type {
  LearningEvidenceRecord,
  ProjectDNA,
  VivaMode,
  VivaSession,
  WorkspaceArtifact,
} from "../types";
import { L, resolveServerLocale, tx, txf, type ServerLocale } from "./server-locale";

// Viva questions are spoken and answered by the learner, so they must be in the
// project's own language rather than a fixed one.
const VIVA = {
  understanding: L(
    "اشرح هدف مشروع “{title}” بكلماتك، وما المخرج الذي يفترض أن يثبت نجاحه؟",
    "Explain the goal of “{title}” in your own words. Which deliverable is supposed to prove it succeeded?",
    "“{title}” projesinin amacını kendi cümlelerinizle anlatın. Başarısını hangi çıktı kanıtlamalı?",
    "用你自己的话说明《{title}》的目标。哪一项交付物应当证明它成功了？",
    "“{title}” का लक्ष्य अपने शब्दों में समझाइए। कौन-सी डिलिवरेबल उसकी सफलता सिद्ध करती है?",
    "Explica con tus palabras el objetivo de «{title}». ¿Qué entregable debe demostrar que tuvo éxito?",
    "Expliquez avec vos mots l'objectif de « {title} ». Quel livrable doit prouver sa réussite ?",
    "«{title}» کا مقصد اپنے الفاظ میں بیان کریں۔ کون سی مخرج اس کی کامیابی ثابت کرتی ہے؟",
  ),
  section: L(
    "في قسم «{section}» كتبت فكرة محورية. لخّصها من ذاكرتك، ثم اذكر دليلاً يدعمها وحدّاً واحداً لا ينبغي تجاوزه.",
    "In the “{section}” section you made a central claim. Summarise it from memory, then give one piece of evidence that supports it and one limit it must not overstep.",
    "“{section}” bölümünde merkezî bir sav ortaya koydunuz. Onu ezberden özetleyin; ardından destekleyen bir kanıt ile aşılmaması gereken bir sınır söyleyin.",
    "在《{section}》一节中你提出了一个核心论点。请凭记忆概括它，并给出一项支持证据和一条不可逾越的界限。",
    "“{section}” अनुभाग में आपने एक केंद्रीय दावा किया। उसे स्मृति से संक्षेप में कहें, फिर एक समर्थक प्रमाण और एक सीमा बताइए।",
    "En la sección «{section}» planteaste una afirmación central. Resúmela de memoria y da una evidencia que la respalde y un límite que no debe superarse.",
    "Dans la section « {section} », vous avez posé une affirmation centrale. Résumez-la de mémoire, puis donnez une preuve qui l'appuie et une limite à ne pas franchir.",
    "«{section}» حصے میں آپ نے ایک مرکزی دعویٰ کیا۔ اسے یادداشت سے مختصر کریں، پھر ایک تائیدی شہادت اور ایک حد بتائیں۔",
  ),
  requirement: L(
    "المتطلب “{label}” يقول: {value}. كيف فهمته، وما الذي ستفعله للتأكد من أنك طبقته بصورة صحيحة؟",
    "The requirement “{label}” states: {value}. How did you understand it, and what will you do to confirm you applied it correctly?",
    "“{label}” gereksinimi şunu söylüyor: {value}. Bunu nasıl anladınız ve doğru uyguladığınızı nasıl doğrulayacaksınız?",
    "要求“{label}”写道：{value}。你是如何理解的？将如何确认自己正确执行了它？",
    "आवश्यकता “{label}” कहती है: {value}। आपने इसे कैसे समझा और सही ढंग से लागू करने की पुष्टि कैसे करेंगे?",
    "El requisito «{label}» dice: {value}. ¿Cómo lo entendiste y qué harás para confirmar que lo aplicaste bien?",
    "L'exigence « {label} » indique : {value}. Comment l'avez-vous comprise et comment confirmerez-vous l'avoir bien appliquée ?",
    "تقاضا “{label}” کہتا ہے: {value}۔ آپ نے اسے کیسے سمجھا اور درست اطلاق کی تصدیق کیسے کریں گے؟",
  ),
  rubric: L(
    "كيف يثبت عملك تحقيق معيار الـRubric: “{criterion}”؟ اذكر دليلًا محددًا من مشروعك.",
    "How does your work prove the rubric criterion “{criterion}” is met? Point to specific evidence in your project.",
    "Çalışmanız “{criterion}” rubrik ölçütünü karşıladığını nasıl kanıtlıyor? Projenizden somut bir kanıt gösterin.",
    "你的工作如何证明满足评分标准“{criterion}”？请指出项目中的具体证据。",
    "आपका कार्य रूब्रिक मानदंड “{criterion}” पूरा होना कैसे सिद्ध करता है? प्रोजेक्ट से विशिष्ट प्रमाण दिखाइए।",
    "¿Cómo demuestra tu trabajo que se cumple el criterio «{criterion}»? Señala evidencia concreta de tu proyecto.",
    "En quoi votre travail prouve-t-il que le critère « {criterion} » est satisfait ? Indiquez une preuve précise de votre projet.",
    "آپ کا کام روبرک معیار “{criterion}” پورا ہونا کیسے ثابت کرتا ہے؟ پروجیکٹ سے مخصوص شہادت بتائیں۔",
  ),
  method: L(
    "اختر خطوة من {actions} واشرح لماذا استخدمتها وما البديل الذي كان ممكنًا.",
    "Pick one step from {actions}, explain why you used it, and say which alternative was possible.",
    "{actions} arasından bir adım seçin; neden kullandığınızı ve hangi alternatifin mümkün olduğunu açıklayın.",
    "从 {actions} 中选择一个步骤，说明你为何采用它，以及当时还有哪种替代做法。",
    "{actions} में से एक चरण चुनें, बताएँ कि आपने उसे क्यों अपनाया और कौन-सा विकल्प संभव था।",
    "Elige un paso de {actions}, explica por qué lo usaste y qué alternativa era posible.",
    "Choisissez une étape parmi {actions}, expliquez pourquoi vous l'avez utilisée et quelle alternative était possible.",
    "{actions} میں سے ایک مرحلہ چنیں، بتائیں کہ کیوں اپنایا اور کون سا متبادل ممکن تھا۔",
  ),
  risk: L(
    "ما أكبر نقطة غير مؤكدة أو مخاطرة في المشروع حاليًا، وكيف ستمنعها من التأثير على التسليم؟",
    "What is the biggest open uncertainty or risk in the project right now, and how will you stop it from affecting the submission?",
    "Projedeki en büyük belirsizlik ya da risk şu anda nedir ve teslimi etkilemesini nasıl önleyeceksiniz?",
    "目前项目中最大的不确定性或风险是什么？你将如何防止它影响提交？",
    "अभी प्रोजेक्ट में सबसे बड़ी अनिश्चितता या जोखिम क्या है, और आप उसे सबमिशन पर असर डालने से कैसे रोकेंगे?",
    "¿Cuál es hoy la mayor incertidumbre o riesgo del proyecto y cómo evitarás que afecte a la entrega?",
    "Quelle est aujourd'hui la plus grande incertitude ou le plus grand risque du projet, et comment l'empêcherez-vous d'affecter le rendu ?",
    "اِس وقت پروجیکٹ میں سب سے بڑا غیر یقینی پہلو یا خطرہ کیا ہے، اور آپ اسے جمع پر اثرانداز ہونے سے کیسے روکیں گے؟",
  ),
  defense: L(
    "ما أضعف جزء في مشروعك؟ لو طلبت منك الدفاع عنه الآن، ما الدليل الذي تملكه وما الدليل الذي ينقصك؟",
    "What is the weakest part of your project? If you had to defend it right now, what evidence do you have and what evidence is missing?",
    "Projenizin en zayıf kısmı hangisi? Şimdi savunmanız gerekse elinizdeki kanıt ne, eksik kanıt ne?",
    "你项目中最薄弱的部分是什么？如果现在就要为它辩护，你手上有什么证据、缺什么证据？",
    "आपके प्रोजेक्ट का सबसे कमज़ोर हिस्सा कौन-सा है? अभी बचाव करना हो तो आपके पास कौन-सा प्रमाण है और कौन-सा नहीं?",
    "¿Cuál es la parte más débil de tu proyecto? Si tuvieras que defenderla ahora, ¿qué evidencia tienes y cuál te falta?",
    "Quelle est la partie la plus faible de votre projet ? S'il fallait la défendre maintenant, quelles preuves avez-vous et lesquelles manquent ?",
    "آپ کے پروجیکٹ کا کمزور ترین حصہ کون سا ہے؟ ابھی دفاع کرنا ہو تو کون سی شہادت موجود ہے اور کون سی کم ہے؟",
  ),
  reproducibility: L(
    "لو أعاد شخص مستقل تنفيذ هذا العمل اعتمادًا على توثيقك فقط، ما الذي قد لا يستطيع إعادة إنتاجه؟ ولماذا؟",
    "If an independent person redid this work using only your documentation, what would they fail to reproduce, and why?",
    "Bağımsız biri yalnızca sizin belgelerinizle bu çalışmayı yeniden yapsa neyi yeniden üretemezdi ve neden?",
    "如果有人只依据你的文档重做这项工作，他会无法复现哪一部分？为什么？",
    "यदि कोई स्वतंत्र व्यक्ति केवल आपके प्रलेखन से यह कार्य दोहराए, तो वह क्या पुनः उत्पन्न नहीं कर पाएगा और क्यों?",
    "Si una persona independiente rehiciera este trabajo solo con tu documentación, ¿qué no lograría reproducir y por qué?",
    "Si une personne indépendante refaisait ce travail avec votre seule documentation, que ne parviendrait-elle pas à reproduire, et pourquoi ?",
    "اگر کوئی آزاد شخص صرف آپ کی دستاویزات سے یہ کام دہرائے تو وہ کیا دوبارہ پیدا نہیں کر سکے گا اور کیوں؟",
  ),
  evidenceSummary: L(
    "أكمل الطالب جلسة Viva بنمط {mode}. تم توثيق {answered} إجابات من {total}. هذا سجل دليل تعلم وليس درجة أو كشفًا لنسبة AI.",
    "The learner completed a {mode} viva session. {answered} of {total} answers were recorded. This is a proof-of-learning record, not a grade or an AI-detection score.",
    "Öğrenci {mode} modunda bir viva oturumunu tamamladı. {total} sorudan {answered} yanıt kaydedildi. Bu bir öğrenme kanıtı kaydıdır; not veya yapay zeka tespiti değildir.",
    "学习者完成了一次「{mode}」模式的答辩。共记录 {total} 题中的 {answered} 个回答。这是学习证据记录，不是成绩，也不是 AI 检测结果。",
    "शिक्षार्थी ने {mode} मोड का वाइवा पूरा किया। {total} में से {answered} उत्तर दर्ज हुए। यह अधिगम-प्रमाण रिकॉर्ड है, न ग्रेड न AI-डिटेक्शन स्कोर।",
    "El estudiante completó una sesión de viva en modo {mode}. Se registraron {answered} de {total} respuestas. Es un registro de evidencia de aprendizaje, no una nota ni una detección de IA.",
    "L'étudiant a terminé une soutenance en mode {mode}. {answered} réponses sur {total} ont été enregistrées. Il s'agit d'une preuve d'apprentissage, pas d'une note ni d'une détection d'IA.",
    "طالب علم نے {mode} موڈ کا وائیوا مکمل کیا۔ {total} میں سے {answered} جوابات محفوظ ہوئے۔ یہ سیکھنے کا ثبوت ہے، نہ گریڈ نہ AI ڈیٹیکشن اسکور۔",
  ),
} as const;

export function createVivaSession(
  project: ProjectDNA,
  mode: VivaMode,
  artifacts: WorkspaceArtifact[] = [],
  requestedLocale?: string,
): VivaSession {
  const locale: ServerLocale = resolveServerLocale(requestedLocale, project.language);
  const questions: VivaSession["questions"] = [];
  const add = (prompt: string, focus: string, relatedRubricId?: string) =>
    questions.push({ id: randomUUID(), prompt, focus, relatedRubricId });
  add(txf(VIVA.understanding, locale, { title: project.title }), "project_understanding");
  const documentSections = artifacts.filter(
    (artifact) => artifact.kind === "academic-document-section",
  );
  if (documentSections.length) {
    const offset = [...project.id].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    );
    const selected = [
      documentSections[offset % documentSections.length],
      documentSections[(offset + Math.max(1, Math.floor(documentSections.length / 2))) % documentSections.length],
    ].filter((section, index, all) => all.findIndex((x) => x.id === section.id) === index);
    for (const section of selected)
      add(
        txf(VIVA.section, locale, { section: section.title }),
        `section:${section.id}`,
        section.rubricIds?.[0],
      );
  }
  const req =
    project.requirements.find((r) => r.confidence === "needs_confirmation") ||
    project.requirements[0];
  if (req)
    add(txf(VIVA.requirement, locale, { label: req.label, value: req.value }), "requirements");
  const rubric =
    project.rubric.find((r) => r.readiness !== "covered") || project.rubric[0];
  if (rubric)
    add(
      txf(VIVA.rubric, locale, { criterion: rubric.title }),
      "rubric_evidence",
      rubric.id,
    );
  if (project.requiredActions.length)
    add(
      txf(VIVA.method, locale, { actions: project.requiredActions.slice(0, 5).join(" / ") }),
      "method_decision",
    );
  if (project.riskFlags.length) add(tx(VIVA.risk, locale), "risk_awareness");
  if (mode === "strict" || mode === "external") add(tx(VIVA.defense, locale), "critical_defense");
  if (mode === "external") add(tx(VIVA.reproducibility, locale), "reproducibility");
  if (mode === "easy" && questions.length > 4) questions.splice(4);
  return {
    id: randomUUID(),
    projectId: project.id,
    userId: project.userId,
    tenantId: project.tenantId,
    mode,
    questions,
    responses: [],
    status: "active",
    createdAt: new Date().toISOString(),
  };
}

export function completeViva(
  session: VivaSession,
  requestedLocale?: string,
): {
  session: VivaSession;
  evidence: LearningEvidenceRecord;
} {
  const locale: ServerLocale = resolveServerLocale(requestedLocale);
  const now = new Date().toISOString();
  const completed: VivaSession = {
    ...session,
    status: "completed",
    completedAt: now,
  };
  const answered = session.responses.filter((r) => r.answer.trim()).length;
  const evidence: LearningEvidenceRecord = {
    id: randomUUID(),
    projectId: session.projectId,
    userId: session.userId,
    tenantId: session.tenantId,
    source: "viva",
    summary: txf(VIVA.evidenceSummary, locale, {
      mode: session.mode,
      answered,
      total: session.questions.length,
    }),
    evidence: session.responses
      .filter((r) => r.answer.trim())
      .map((r) => ({
        label:
          session.questions.find((q) => q.id === r.questionId)?.focus ||
          "viva_response",
        value: r.answer.trim().slice(0, 1200),
      })),
    createdAt: now,
  };
  return { session: completed, evidence };
}
