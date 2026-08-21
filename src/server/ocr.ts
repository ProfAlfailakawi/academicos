import type { OcrExtractionRecord } from "../types";
import type { IncomingFile } from "./file-extract";

export interface OcrCandidate {
  provider: string;
  text: string;
  confidence: number;
  languages: string[];
  pageCount: number;
  layoutPreserved: boolean;
  warnings: string[];
}

export interface OcrResult {
  text: string;
  extraction: OcrExtractionRecord;
}

function configured(prefix: "PRIMARY" | "SECONDARY") {
  return Boolean(
    process.env[`OCR_${prefix}_URL`] && process.env[`OCR_${prefix}_TOKEN`],
  );
}

function checkedEndpoint(prefix: "PRIMARY" | "SECONDARY") {
  const raw = String(process.env[`OCR_${prefix}_URL`] || "");
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw Object.assign(new Error(`OCR_${prefix}_URL is invalid`), {
      status: 500,
      code: "OCR_ENDPOINT_INVALID",
    });
  }
  if (url.protocol !== "https:" || url.username || url.password)
    throw Object.assign(
      new Error("OCR endpoint must use HTTPS without embedded credentials"),
      { status: 500, code: "OCR_ENDPOINT_INVALID" },
    );
  const allow = String(process.env.OCR_ALLOWED_HOSTS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (process.env.NODE_ENV === "production" && !allow.length)
    throw Object.assign(
      new Error("OCR_ALLOWED_HOSTS is required in production"),
      { status: 500, code: "OCR_ALLOWLIST_REQUIRED" },
    );
  if (allow.length && !allow.includes(url.hostname.toLowerCase()))
    throw Object.assign(new Error("OCR endpoint host is not allowlisted"), {
      status: 500,
      code: "OCR_ENDPOINT_BLOCKED",
    });
  return url.toString();
}

function cleanText(value: unknown) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .slice(0, 240_000)
    .trim();
}
function clampConfidence(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n > 1 ? n / 100 : n)) : 0;
}
function stringList(value: unknown, max = 12) {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .map(String)
            .map((x) => x.trim().slice(0, 40))
            .filter(Boolean),
        ),
      ].slice(0, max)
    : [];
}

export function normalizeOcrCandidate(
  provider: string,
  payload: any,
): OcrCandidate {
  const text = cleanText(
    payload?.text ?? payload?.fullText ?? payload?.result?.text,
  );
  if (!text)
    throw Object.assign(new Error(`${provider} returned no OCR text`), {
      status: 502,
      code: "OCR_EMPTY",
    });
  return {
    provider,
    text,
    confidence: clampConfidence(
      payload?.confidence ?? payload?.result?.confidence,
    ),
    languages: stringList(payload?.languages ?? payload?.detectedLanguages),
    pageCount: Math.max(
      1,
      Math.min(
        500,
        Number(payload?.pageCount ?? payload?.pages?.length ?? 1) || 1,
      ),
    ),
    layoutPreserved: Boolean(
      payload?.layoutPreserved ?? payload?.blocks?.length,
    ),
    warnings: stringList(payload?.warnings, 20),
  };
}

async function callProvider(
  prefix: "PRIMARY" | "SECONDARY",
  file: IncomingFile,
): Promise<OcrCandidate> {
  const url = checkedEndpoint(prefix),
    token = String(process.env[`OCR_${prefix}_TOKEN`] || ""),
    provider = String(
      process.env[`OCR_${prefix}_NAME`] || prefix.toLowerCase(),
    );
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      "x-academicos-purpose": "assignment-ocr",
    },
    body: JSON.stringify({
      document: {
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        base64: file.base64,
      },
      features: {
        languages: ["ar", "en"],
        preserveLayout: true,
        handwriting: true,
        tables: true,
        readingOrder: true,
      },
    }),
    signal: AbortSignal.timeout(
      Math.max(
        10_000,
        Math.min(120_000, Number(process.env.OCR_TIMEOUT_MS || 60_000)),
      ),
    ),
  });
  const payload: any = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(`${provider} failed with HTTP ${response.status}`),
      { status: 502, code: "OCR_PROVIDER_FAILED" },
    );
  return normalizeOcrCandidate(provider, payload);
}

function tokens(text: string) {
  return new Set(
    text
      .toLocaleLowerCase("ar")
      .normalize("NFKC")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(/\s+/)
      .filter((x) => x.length > 1)
      .slice(0, 20_000),
  );
}
export function ocrAgreement(a: string, b: string) {
  const aa = tokens(a),
    bb = tokens(b);
  if (!aa.size && !bb.size) return 1;
  let intersection = 0;
  for (const token of aa) if (bb.has(token)) intersection++;
  return intersection / Math.max(1, new Set([...aa, ...bb]).size);
}

export function selectOcrCandidate(
  candidates: OcrCandidate[],
  threshold = 0.84,
): OcrResult {
  if (!candidates.length)
    throw Object.assign(new Error("No OCR candidate is available"), {
      status: 503,
      code: "OCR_NOT_CONFIGURED",
    });
  const ranked = [...candidates].sort(
    (a, b) => b.confidence - a.confidence || b.text.length - a.text.length,
  );
  const best = ranked[0],
    agreement = ranked[1] ? ocrAgreement(best.text, ranked[1].text) : undefined;
  const warnings = [...best.warnings];
  if (best.confidence < threshold)
    warnings.push(
      `ثقة OCR أقل من الحد المطلوب (${Math.round(best.confidence * 100)}%).`,
    );
  if (agreement !== undefined && agreement < 0.72)
    warnings.push(
      `اختلف مزودا OCR؛ نسبة الاتفاق ${Math.round(agreement * 100)}%.`,
    );
  if (best.text.length < 80)
    warnings.push(
      "النص المستخرج قصير بصورة غير معتادة ويحتاج مراجعة الصورة الأصلية.",
    );
  if (!best.layoutPreserved)
    warnings.push("لم يؤكد المزود الحفاظ على ترتيب القراءة والجداول.");
  return {
    text: best.text,
    extraction: {
      mode: "ocr",
      provider: ranked.map((x) => x.provider).join("+"),
      confidence: best.confidence,
      agreement,
      languages: best.languages,
      pageCount: best.pageCount,
      layoutPreserved: best.layoutPreserved,
      needsReview: warnings.length > 0,
      warnings: [...new Set(warnings)],
      extractedCharacters: best.text.length,
    },
  };
}

export async function runOcr(file: IncomingFile): Promise<OcrResult | null> {
  const prefixes = (["PRIMARY", "SECONDARY"] as const).filter(configured);
  if (!prefixes.length) {
    if (process.env.REQUIRE_OCR === "true")
      throw Object.assign(
        new Error("OCR is required but no provider is configured"),
        { status: 503, code: "OCR_REQUIRED" },
      );
    return null;
  }
  const settled = await Promise.allSettled(
    prefixes.map((prefix) => callProvider(prefix, file)),
  );
  const candidates = settled
    .filter(
      (x): x is PromiseFulfilledResult<OcrCandidate> =>
        x.status === "fulfilled",
    )
    .map((x) => x.value);
  const errors = settled
    .filter((x): x is PromiseRejectedResult => x.status === "rejected")
    .map((x) => String(x.reason?.message || "OCR provider failed"));
  if (!candidates.length)
    throw Object.assign(
      new Error(errors.join(" · ") || "OCR providers failed"),
      { status: 502, code: "OCR_FAILED" },
    );
  const result = selectOcrCandidate(
    candidates,
    Math.max(
      0.5,
      Math.min(0.99, Number(process.env.OCR_MIN_CONFIDENCE || 0.84)),
    ),
  );
  if (errors.length) {
    result.extraction.warnings.push(...errors);
    result.extraction.needsReview = true;
  }
  return result;
}

export function ocrStatus() {
  const primary = configured("PRIMARY"),
    secondary = configured("SECONDARY");
  return {
    configured: primary || secondary,
    primary,
    secondary,
    ensemble: primary && secondary,
    required: process.env.REQUIRE_OCR === "true",
    minConfidence: Number(process.env.OCR_MIN_CONFIDENCE || 0.84),
  };
}
