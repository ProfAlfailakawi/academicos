// Orchestration for Project Copilot File Search: turn project/course records into
// a self-hosted vector index, and answer file_search queries from it. This layer
// is intentionally thin — the testable logic lives in retrieval.ts, the storage in
// db.ts. Kept out of server.ts to keep the route handler small.

import type { ProjectDNA, ProjectEvidence, WorkspaceArtifact, CopilotCitation } from "../types";
import { firestoreStore } from "./db";
import {
  chunkSources,
  embedTexts,
  embeddingsConfigured,
  rankedChunksToCitations,
  topKBySimilarity,
  type RawSource,
  type StoredChunk,
} from "./retrieval";

export interface RetrievalScope {
  tenantId: string;
  scopeType: "project" | "course";
  scopeId: string;
  projectId?: string;
}

function clip(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Build the untrusted source set for a project from its DNA, rubric, artifacts, and evidence. */
export function projectRawSources(
  project: ProjectDNA,
  artifacts: WorkspaceArtifact[],
  evidence: ProjectEvidence[],
  extra: RawSource[] = [],
): RawSource[] {
  const sources: RawSource[] = [];
  sources.push({
    sourceType: "project",
    sourceId: project.id,
    title: project.title,
    locator: `Project DNA r${project.revision || 1}`,
    trust: "recorded",
    text: [
      project.course ? `Course: ${project.course}.` : "",
      project.learningOutcomes?.length ? `Learning outcomes: ${project.learningOutcomes.join("; ")}.` : "",
      project.requiredActions?.length ? `Required actions: ${project.requiredActions.join("; ")}.` : "",
    ].filter(Boolean).join("\n"),
  });
  for (const rubric of project.rubric || []) {
    if (!rubric?.description) continue;
    sources.push({
      sourceType: "rubric",
      sourceId: rubric.id,
      title: rubric.title,
      locator: `${rubric.weighting}%`,
      trust: "recorded",
      text: `${rubric.title}: ${rubric.description}`,
      rubricIds: [rubric.id],
      evidenceIds: rubric.evidenceIds || [],
    });
  }
  for (const artifact of artifacts || []) {
    if (!artifact?.content) continue;
    sources.push({
      sourceType: "artifact",
      sourceId: artifact.id,
      title: artifact.title,
      locator: `${artifact.module}/${artifact.kind}`,
      trust: artifact.isCanonical ? "user_verified" : "recorded",
      text: `${artifact.title}\n${artifact.content}`,
      rubricIds: artifact.rubricIds || [],
    });
  }
  for (const item of evidence || []) {
    if (!item?.detail) continue;
    sources.push({
      sourceType: "evidence",
      sourceId: item.id,
      title: item.title,
      locator: item.sourceUrl,
      trust:
        item.verification === "institution_verified"
          ? "institution_verified"
          : item.verification === "user_verified"
            ? "user_verified"
            : "unverified",
      text: `${item.title}\n${item.detail}`,
      rubricIds: item.rubricIds || [],
      evidenceIds: [item.id],
    });
  }
  return [...sources, ...extra];
}

export interface IngestResult {
  ok: boolean;
  reason?: string;
  indexed: number;
  removed: number;
  truncated: boolean;
  backend: string;
  model: string;
  dim: number;
  chars: number;
  latencyMs: number;
}

/** Chunk → embed → persist the index for a scope. Returns stats used for cost/observability. */
export async function ingestRetrievalIndex(scope: RetrievalScope, sources: RawSource[]): Promise<IngestResult> {
  const started = Date.now();
  if (!embeddingsConfigured()) {
    return { ok: false, reason: "embeddings_not_configured", indexed: 0, removed: 0, truncated: false, backend: "none", model: "", dim: 0, chars: 0, latencyMs: Date.now() - started };
  }
  const chunks = chunkSources(sources);
  if (!chunks.length) {
    const cleared = await firestoreStore.replaceRetrievalIndex(scope.tenantId, scope.scopeType, scope.scopeId, [], scope.projectId);
    return { ok: true, reason: "empty_sources", indexed: 0, removed: cleared.removed, truncated: false, backend: "none", model: "", dim: 0, chars: 0, latencyMs: Date.now() - started };
  }
  const capped = chunks.slice(0, 400);
  const { embeddings, backend, model, dim } = await embedTexts(capped.map((c) => c.text));
  const stored = capped
    .map((chunk, i) => ({ ...chunk, embedding: embeddings[i] || [] }))
    .filter((c) => c.embedding.length > 0);
  const result = await firestoreStore.replaceRetrievalIndex(
    scope.tenantId,
    scope.scopeType,
    scope.scopeId,
    stored.map((c) => ({ ...c })),
    scope.projectId,
  );
  return {
    ok: true,
    indexed: result.indexed,
    removed: result.removed,
    truncated: chunks.length > capped.length,
    backend,
    model,
    dim,
    chars: capped.reduce((sum, c) => sum + c.text.length, 0),
    latencyMs: Date.now() - started,
  };
}

export interface FileSearchResult {
  ok: boolean;
  reason?: string;
  citations: CopilotCitation[];
  matched: number;
  indexSize: number;
  backend: string;
  model: string;
  latencyMs: number;
}

/** Answer a file_search query from the self-hosted index. Honest empty result when not usable. */
export async function semanticFileSearch(scope: RetrievalScope, query: string, k = 6): Promise<FileSearchResult> {
  const started = Date.now();
  const clean = clip(query, 4000);
  if (!embeddingsConfigured()) {
    return { ok: false, reason: "embeddings_not_configured", citations: [], matched: 0, indexSize: 0, backend: "none", model: "", latencyMs: Date.now() - started };
  }
  const rows = await firestoreStore.listRetrievalChunks(scope.tenantId, scope.scopeType, scope.scopeId);
  if (!rows.length) {
    return { ok: false, reason: "index_empty", citations: [], matched: 0, indexSize: 0, backend: "none", model: "", latencyMs: Date.now() - started };
  }
  if (!clean) {
    return { ok: false, reason: "empty_query", citations: [], matched: 0, indexSize: rows.length, backend: "none", model: "", latencyMs: Date.now() - started };
  }
  const stored: StoredChunk[] = rows
    .filter((r) => Array.isArray(r.embedding) && r.embedding.length)
    .map((r) => ({
      id: r.chunkId || r.id,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      title: r.title,
      locator: r.locator,
      text: r.text,
      trust: r.trust,
      rubricIds: r.rubricIds,
      evidenceIds: r.evidenceIds,
      ordinal: Number(r.ordinal || 0),
      embedding: r.embedding.map(Number),
    }));
  const { embeddings, backend, model } = await embedTexts([clean]);
  const queryEmbedding = embeddings[0] || [];
  const ranked = topKBySimilarity(queryEmbedding, stored, k);
  return {
    ok: true,
    citations: rankedChunksToCitations(ranked),
    matched: ranked.length,
    indexSize: rows.length,
    backend,
    model,
    latencyMs: Date.now() - started,
  };
}
