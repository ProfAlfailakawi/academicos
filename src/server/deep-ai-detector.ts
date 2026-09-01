import { randomUUID } from "node:crypto";

export interface SentenceAnalysis {
  text: string;
  aiProbability: number; // 0 to 100
  burstinessScore: number;
  perplexityIndicator: "very_low" | "low" | "medium" | "high" | "human_like";
  reasons: string[];
  highlightColor: "red" | "orange" | "yellow" | "green";
}

export interface DeepAIDetectionReport {
  overallAIScore: number; // 0 to 100 (0 = 100% human, 100 = purely synthetic AI)
  verdict: "authentic_human" | "human_ai_collaborative" | "likely_ai_generated" | "heavily_synthetic_ai";
  verdictLabel: string;
  confidenceScore: number; // 0 to 100
  metrics: {
    perplexityScore: number; // 0 - 100
    burstinessScore: number; // 0 - 100
    vocabularyDiversity: number; // TTR
    syntacticUniformity: number; // sentence length variance
    aiHallmarkPhrasesCount: number;
    ghostCitationCount: number;
    passiveOveruseScore: number;
  };
  sentenceBreakdown: SentenceAnalysis[];
  detectedClichés: Array<{
    phrase: string;
    category: "ai_hallmark" | "hedging" | "fake_elaboration" | "robotic_transition";
    occurrences: number;
  }>;
  forensicSignals: Array<{
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
  }>;
  humanizationRecommendations: string[];
}

const AI_HALLMARKS = [
  // English common AI phrases
  { pattern: /\b(delve|delving|delved)\s+into\b/gi, label: "delve into", cat: "ai_hallmark" },
  { pattern: /\btestament\s+to\b/gi, label: "testament to", cat: "ai_hallmark" },
  { pattern: /\btapestry\s+of\b/gi, label: "tapestry of", cat: "ai_hallmark" },
  { pattern: /\bbeacon\s+of\b/gi, label: "beacon of", cat: "ai_hallmark" },
  { pattern: /\bpivotal\s+role\b/gi, label: "pivotal role", cat: "ai_hallmark" },
  { pattern: /\bfoster(?:ing)?\s+(?:innovation|collaboration|growth)\b/gi, label: "foster innovation/growth", cat: "ai_hallmark" },
  { pattern: /\blandscape\s+of\b/gi, label: "landscape of", cat: "ai_hallmark" },
  { pattern: /\bseamlessly\s+integrat(?:e|ed|ing)\b/gi, label: "seamlessly integrate", cat: "ai_hallmark" },
  { pattern: /\bin\s+conclusion,\s+it\s+is\s+crucial\s+to\b/gi, label: "in conclusion, it is crucial", cat: "ai_hallmark" },
  { pattern: /\bit\s+is\s+worth\s+noting\s+that\b/gi, label: "it is worth noting that", cat: "hedging" },
  { pattern: /\bnot\s+only\s+[\w\s]+,\s+but\s+also\b/gi, label: "not only..., but also", cat: "robotic_transition" },
  { pattern: /\bplays\s+a\s+vital\s+role\b/gi, label: "plays a vital role", cat: "ai_hallmark" },
  { pattern: /\bholistic\s+approach\b/gi, label: "holistic approach", cat: "ai_hallmark" },
  { pattern: /\bever-evolving\s+world\b/gi, label: "ever-evolving world", cat: "ai_hallmark" },
  { pattern: /\bnavigat(?:e|ing)\s+the\s+complexities\b/gi, label: "navigating the complexities", cat: "ai_hallmark" },
  { pattern: /\bcornerstone\s+of\b/gi, label: "cornerstone of", cat: "ai_hallmark" },
  { pattern: /\bgroundbreaking\s+(?:study|technology|approach)\b/gi, label: "groundbreaking study/tech", cat: "ai_hallmark" },
  
  // Arabic AI clichés and LLM translation quirks
  { pattern: /(?:في\s+ختام\s+هذا|وفي\s+الختام،?\s+يمكن\s+القول|ومما\s+لا\s+شك\s+فيه)/gu, label: "كليشيهات الختام التوليدية", cat: "robotic_transition" },
  { pattern: /(?:يلعب\s+دوراً\s+(?:حاسماً|محورياً|أساسياً|لا\s+غنى\s+عنه)|تلعب\s+دوراً\s+(?:حاسماً|محورياً))/gu, label: "يلعب دوراً محورياً/حاسماً", cat: "ai_hallmark" },
  { pattern: /(?:في\s+ظل\s+التطورات\s+المتسارعة|في\s+عالمنا\s+المعاصر|في\s+عصرنا\s+الحالي)/gu, label: "مقدمات الإنشاء العامة", cat: "hedging" },
  { pattern: /(?:من\s+الجدير\s+بالذكر\s+أن|تجدر\s+الإشارة\s+إلى\s+أن|لا\s+يخفى\s+على\s+أحد\s+أن)/gu, label: "حشو تأكيدي نمطي", cat: "hedging" },
  { pattern: /(?:حجر\s+الزاوية|حجر\s+أساس|منارة\s+(?:للعلم|للابتكار))/gu, label: "استعارات مترجمة حرفياً (Cornerstone/Beacon)", cat: "ai_hallmark" },
  { pattern: /(?:نسيج\s+معقد|خارطة\s+طريق\s+شاملة|نهج\s+شامل\s+ومتكامل)/gu, label: "تعبيرات نموذجية شائعة للذكاء الاصطناعي", cat: "ai_hallmark" },
  { pattern: /(?:يسلط\s+الضوء\s+على|إلقاء\s+الضوء\s+على\s+أهمية)/gu, label: "يسلط الضوء على", cat: "ai_hallmark" },
  { pattern: /(?:من\s+ناحية\s+أخرى،?\s+فإن|وعلاوة\s+على\s+ذلك،?\s+فإن|وبالإضافة\s+إلى\s+ما\s+سبق)/gu, label: "روابط انتقالية ميكانيكية متتالية", cat: "robotic_transition" },
  { pattern: /(?:لا\s+يقتصر\s+الأمر\s+على\s+.*?\s+بل\s+يتعداه\s+إلى)/gu, label: "صيغة Not only but also المترجمة", cat: "robotic_transition" }
] as const;

export function runDeepAIDetection(rawText: string): DeepAIDetectionReport {
  const text = String(rawText || "").trim();
  if (!text || text.length < 50) {
    return {
      overallAIScore: 0,
      verdict: "authentic_human",
      verdictLabel: "نص قصير جداً للتحليل الجنائي",
      confidenceScore: 30,
      metrics: {
        perplexityScore: 90,
        burstinessScore: 85,
        vocabularyDiversity: 95,
        syntacticUniformity: 10,
        aiHallmarkPhrasesCount: 0,
        ghostCitationCount: 0,
        passiveOveruseScore: 0,
      },
      sentenceBreakdown: [],
      detectedClichés: [],
      forensicSignals: [],
      humanizationRecommendations: ["أدخل نصاً لا يقل عن 100 كلمة للتشخيص الجنائي العميق."],
    };
  }

  // Split into sentences
  const rawSentences = text
    .split(/(?<=[.?!؟!\n])\s+/u)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const words = text.split(/\s+/u).filter(Boolean);
  const totalWords = words.length;

  // 1. Vocabulary Diversity (Type-Token Ratio adjusted for length)
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "")));
  const ttr = (uniqueWords.size / Math.max(1, totalWords)) * 100;
  const vocabularyDiversity = Math.round(Math.min(100, ttr * 1.3));

  // 2. Sentence Length Variance (Burstiness)
  const sentenceLengths = rawSentences.map((s) => s.split(/\s+/u).length);
  const avgLen = sentenceLengths.reduce((a, b) => a + b, 0) / Math.max(1, sentenceLengths.length);
  const variance =
    sentenceLengths.reduce((sum, len) => sum + Math.pow(len - avgLen, 2), 0) /
    Math.max(1, sentenceLengths.length);
  const stdDev = Math.sqrt(variance);
  
  // High variance = Human (bursty, varying lengths: short, long, very long).
  // Low variance (< 3.5) = AI (rhythmic, monotone, 18-24 words per sentence).
  const burstinessScore = Math.round(Math.min(100, (stdDev / (avgLen || 1)) * 140));
  const syntacticUniformity = Math.round(Math.max(0, 100 - burstinessScore));

  // 3. Scan for AI Hallmark clichés
  const clichéCounts = new Map<string, { label: string; cat: any; count: number }>();
  let totalClichés = 0;

  for (const hallmark of AI_HALLMARKS) {
    const matches = text.match(hallmark.pattern);
    if (matches && matches.length > 0) {
      clichéCounts.set(hallmark.label, {
        label: hallmark.label,
        cat: hallmark.cat,
        count: matches.length,
      });
      totalClichés += matches.length;
    }
  }

  const detectedClichés = [...clichéCounts.values()].map((c) => ({
    phrase: c.label,
    category: c.cat,
    occurrences: c.count,
  }));

  // 4. Ghost Citation / Fake Reference Detection
  // Common hallucinated patterns: "(Smith & Johnson, 2024)", "et al., 2023" without doi or specific title context
  const genericCitationMatches = (text.match(/\([A-Z][a-z]+(?:\s+et\s+al\.|\s+&\s+[A-Z][a-z]+)?,\s*(?:19|20)\d{2}\)/g) || []).length;
  const hasDois = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i.test(text);
  const ghostCitationCount = genericCitationMatches > 5 && !hasDois ? genericCitationMatches : 0;

  // 5. Perplexity calculation approximation (Stylometric Entropy)
  // AI text has predictable n-grams and transition words at sentence starts
  const transitionStarts = rawSentences.filter((s) =>
    /^(moreover|furthermore|additionally|consequently|therefore|in addition|in conclusion|علاوة على ذلك|بالإضافة إلى ذلك|ومن هنا|وختاماً|من الجدير بالذكر)/i.test(
      s,
    ),
  ).length;
  const transitionRatio = transitionStarts / Math.max(1, rawSentences.length);

  let basePerplexity = 75;
  if (transitionRatio > 0.4) basePerplexity -= 25;
  if (syntacticUniformity > 70) basePerplexity -= 20;
  if (totalClichés > 3) basePerplexity -= 20;
  const perplexityScore = Math.max(10, Math.min(98, basePerplexity));

  // 6. Sentence by Sentence AI Probability Analysis
  const sentenceBreakdown: SentenceAnalysis[] = rawSentences.map((sentence) => {
    const sWords = sentence.split(/\s+/u).length;
    let sAiProb = 15; // baseline human
    const sReasons: string[] = [];

    // Length monotony check
    if (sWords >= 16 && sWords <= 25) {
      sAiProb += 15;
      sReasons.push("إيقاع طولي نمطي للذكاء الاصطناعي (16-25 كلمة)");
    }

    // Check clichés in this sentence
    for (const h of AI_HALLMARKS) {
      if (h.pattern.test(sentence)) {
        sAiProb += 30;
        sReasons.push(`اشتمال على عبارة كليشيه: "${h.label}"`);
      }
    }

    // Check robotic transition
    if (/^(moreover|furthermore|additionally|in conclusion|علاوة على ذلك|بالإضافة إلى ذلك|ومن هذا المنطلق)/i.test(sentence)) {
      sAiProb += 20;
      sReasons.push("رابط منطقي ميكانيكي في بداية الجملة");
    }

    // Check passive / hedging
    if (/(?:من الممكن أن يسهم|يمكن القول بأن|it can be argued that|is widely considered)/i.test(sentence)) {
      sAiProb += 15;
      sReasons.push("أسلوب تحوّط وتعميم مفرط");
    }

    sAiProb = Math.min(99, Math.max(5, sAiProb));

    let highlightColor: SentenceAnalysis["highlightColor"] = "green";
    let perplexityInd: SentenceAnalysis["perplexityIndicator"] = "human_like";

    if (sAiProb >= 75) {
      highlightColor = "red";
      perplexityInd = "very_low";
    } else if (sAiProb >= 50) {
      highlightColor = "orange";
      perplexityInd = "low";
    } else if (sAiProb >= 30) {
      highlightColor = "yellow";
      perplexityInd = "medium";
    }

    return {
      text: sentence,
      aiProbability: sAiProb,
      burstinessScore: Math.round(Math.abs(sWords - avgLen) * 5),
      perplexityIndicator: perplexityInd,
      reasons: sReasons.length ? sReasons : ["صياغة بشرية طبيعية وتدفق عضوي."],
      highlightColor,
    };
  });

  // Calculate Weighted AI Score
  const highAiSentences = sentenceBreakdown.filter((s) => s.aiProbability >= 70).length;
  const sentenceAiAvg = sentenceBreakdown.reduce((sum, s) => sum + s.aiProbability, 0) / Math.max(1, sentenceBreakdown.length);
  
  let calculatedAIScore = Math.round(
    sentenceAiAvg * 0.5 +
    syntacticUniformity * 0.25 +
    Math.min(100, totalClichés * 12) * 0.25
  );

  if (highAiSentences / sentenceBreakdown.length > 0.6) {
    calculatedAIScore = Math.max(calculatedAIScore, 85);
  }
  if (totalClichés === 0 && burstinessScore > 70 && syntacticUniformity < 30) {
    calculatedAIScore = Math.min(calculatedAIScore, 18);
  }

  const overallAIScore = Math.max(2, Math.min(99, calculatedAIScore));

  // Verdict determination
  let verdict: DeepAIDetectionReport["verdict"] = "authentic_human";
  let verdictLabel = "نص بشري أصيل وموثوق 100%";
  if (overallAIScore >= 75) {
    verdict = "heavily_synthetic_ai";
    verdictLabel = "توليد كامل بنماذج الذكاء الاصطناعي (High AI Synthetic Probability)";
  } else if (overallAIScore >= 50) {
    verdict = "likely_ai_generated";
    verdictLabel = "احتمالية عالية لتدخل الذكاء الاصطناعي في الصياغة";
  } else if (overallAIScore >= 25) {
    verdict = "human_ai_collaborative";
    verdictLabel = "صياغة هجينة (تعديل بشري مع مساعدة ذكية)";
  }

  // Forensic Signals
  const forensicSignals: DeepAIDetectionReport["forensicSignals"] = [];
  if (syntacticUniformity > 65) {
    forensicSignals.push({
      title: "رتابة هيكلية مفرطة (Monotonous Sentence Flow)",
      description: "تقارب أطوال الجمل بشكل غير طبيعي يعكس النبض الآلي لتوليد الـ Tokens.",
      severity: "high",
    });
  }
  if (totalClichés > 2) {
    forensicSignals.push({
      title: `رصد ${totalClichés} مصطلحات من بصمات الـ LLM الكلاسيكية`,
      description: `تم رصد عبارات مشهورة لنماذج الذكاء الاصطناعي مثل (${detectedClichés.map((d) => d.phrase).slice(0, 3).join(", ")})`,
      severity: "critical",
    });
  }
  if (transitionRatio > 0.35) {
    forensicSignals.push({
      title: "إفراط في الروابط الميكانيكية التوليدية",
      description: "أكثر من 35% من الجمل تبدأ بروابط ميكانيكية متتالية تفتقر للمنطق الداخلي للكاتب.",
      severity: "medium",
    });
  }
  if (ghostCitationCount > 0) {
    forensicSignals.push({
      title: "اشتباه في مراجع وهمية غير موثقة (Hallucinated Citations)",
      description: "اقتباسات نصية تتبع أنماط التوليد السطحي دون روابط تحقق رقمية أو DOI.",
      severity: "high",
    });
  }
  if (forensicSignals.length === 0) {
    forensicSignals.push({
      title: "سلوك لغوي وبصمة أسلوبية بشرية طبيعية (Organic Stylometry)",
      description: "تنوع ملموس في طول الجمل وتوزيع المفردات يخلو من علامات النماذج التوليدية.",
      severity: "low",
    });
  }

  // Humanization Recommendations
  const humanizationRecommendations: string[] = [];
  if (totalClichés > 0) {
    humanizationRecommendations.push("استبدل العبارات النمطية (مثل 'يلعب دوراً محورياً' أو 'delve into') بأفعال وأدلة علمية مباشرة ومحددة.");
  }
  if (syntacticUniformity > 50) {
    humanizationRecommendations.push("نوّع في أطوال الجمل: ادمج جملاً قصيرة جداً (3-7 كلمات) مع جمل تحليلية مركبة لكسر الرتابة الآلية.");
  }
  if (transitionRatio > 0.25) {
    humanizationRecommendations.push("قلل من الروابط التلقائية في بداية كل جملة (مثل 'علاوة على ذلك') واجعل الأفكار تترابط منطقياً.");
  }
  humanizationRecommendations.push("اربط كل ادعاء بدليل تجريبي أو إحصائية من مصدر حقيقي مفعّل عبر محرك Live Scholar.");

  return {
    overallAIScore,
    verdict,
    verdictLabel,
    confidenceScore: Math.min(98, 80 + Math.round(totalWords / 200)),
    metrics: {
      perplexityScore,
      burstinessScore,
      vocabularyDiversity,
      syntacticUniformity,
      aiHallmarkPhrasesCount: totalClichés,
      ghostCitationCount,
      passiveOveruseScore: Math.round(transitionRatio * 100),
    },
    sentenceBreakdown,
    detectedClichés,
    forensicSignals,
    humanizationRecommendations,
  };
}
