import test from "node:test";
import assert from "node:assert/strict";
import {
  chunkText,
  chunkSources,
  cosineSimilarity,
  topKBySimilarity,
  rankedChunksToCitations,
  parseGeminiGrounding,
  parseGatewayGrounding,
  embeddingsConfigured,
  embeddingBackend,
  groundingConfigured,
  type StoredChunk,
} from "../src/server/retrieval";

test("chunkText is deterministic and bounded", () => {
  const text = Array.from({ length: 40 }, (_, i) => `Paragraph ${i} about evidence-based design and rubric alignment.`).join("\n\n");
  const a = chunkText(text, 400, 60);
  const b = chunkText(text, 400, 60);
  assert.deepEqual(a, b, "same input yields identical chunks");
  assert.ok(a.length > 1, "long text is split");
  assert.ok(a.every((c) => c.length <= 400 + 60), "chunks respect max + overlap");
});

test("chunkText keeps short text as a single chunk and drops empties", () => {
  assert.deepEqual(chunkText("short note"), ["short note"]);
  assert.deepEqual(chunkText("   \n\n  "), []);
});

test("chunkSources produces content-addressed, stable ids", () => {
  const sources = [{ sourceType: "artifact" as const, sourceId: "a1", title: "Notes", text: "one two three ".repeat(200) }];
  const first = chunkSources(sources, 300, 40);
  const second = chunkSources(sources, 300, 40);
  assert.deepEqual(first.map((c) => c.id), second.map((c) => c.id));
  assert.ok(first.every((c) => c.sourceId === "a1" && c.trust === "recorded"));
});

test("cosineSimilarity handles identical, orthogonal, and mismatched vectors", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0, 1], [1, 0, 1]) - 1) < 1e-9);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 0], [1, 0, 0]), 0, "mismatched dims => 0");
  assert.equal(cosineSimilarity([0, 0], [0, 0]), 0, "zero vectors => 0");
});

const chunks: StoredChunk[] = [
  { id: "c1", sourceType: "evidence", sourceId: "e1", title: "Navigation study", text: "Users struggled with navigation labels.", trust: "user_verified", ordinal: 0, embedding: [1, 0, 0] },
  { id: "c2", sourceType: "artifact", sourceId: "a1", title: "Colour notes", text: "Palette exploration for the poster.", trust: "recorded", ordinal: 0, embedding: [0, 1, 0] },
  { id: "c3", sourceType: "rubric", sourceId: "r1", title: "Evidence quality", text: "Cite reliable sources.", trust: "recorded", ordinal: 0, embedding: [0.9, 0.1, 0] },
];

test("topKBySimilarity ranks by score, applies floor, and is stable", () => {
  const ranked = topKBySimilarity([1, 0, 0], chunks, 2, 0.15);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].chunk.id, "c1");
  assert.equal(ranked[1].chunk.id, "c3");
  const filtered = topKBySimilarity([0, 0, 1], chunks, 3, 0.15);
  assert.equal(filtered.length, 0, "nothing above floor for an orthogonal query");
});

test("rankedChunksToCitations preserves trust and never invents web sources", () => {
  const citations = rankedChunksToCitations(topKBySimilarity([1, 0, 0], chunks, 3, 0.15));
  assert.ok(citations.length >= 1);
  assert.ok(citations.every((c) => c.sourceType !== "web"));
  assert.ok(citations.some((c) => c.trust === "user_verified"));
  assert.ok(citations[0].id.startsWith("filesearch:"));
});

test("parseGeminiGrounding extracts web citations, dedupes, and marks trust grounded", () => {
  const json = {
    candidates: [
      {
        content: { parts: [{ text: "Recent studies suggest X." }] },
        groundingMetadata: {
          webSearchQueries: ["evidence based design"],
          groundingChunks: [
            { web: { uri: "https://a.example/1", title: "Source A", snippet: "snippet a" } },
            { web: { uri: "https://a.example/1", title: "Source A dup" } },
            { web: { uri: "https://b.example/2", title: "Source B" } },
          ],
        },
      },
    ],
    usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34, totalTokenCount: 46 },
  };
  const g = parseGeminiGrounding(json, "gemini-x");
  assert.equal(g.answer, "Recent studies suggest X.");
  assert.equal(g.citations.length, 2, "duplicate uri collapsed");
  assert.ok(g.citations.every((c) => c.sourceType === "web" && c.trust === "grounded"));
  assert.deepEqual(g.queries, ["evidence based design"]);
  assert.equal(g.usage?.totalTokens, 46);
});

test("parseGatewayGrounding normalizes an institution gateway response", () => {
  const g = parseGatewayGrounding({ answer: "Grounded answer.", provider: "inst-gw", citations: [{ uri: "https://x.example", title: "X", snippet: "s" }] }, "m");
  assert.equal(g.answer, "Grounded answer.");
  assert.equal(g.provider, "inst-gw");
  assert.equal(g.citations[0].trust, "grounded");
});

test("configuration detectors are honest about missing providers", () => {
  const clean: NodeJS.ProcessEnv = {};
  assert.equal(embeddingsConfigured(clean), false);
  assert.equal(embeddingBackend(clean), "none");
  assert.equal(groundingConfigured(clean), false);
  assert.equal(embeddingBackend({ EMBEDDING_GATEWAY_URL: "https://e", EMBEDDING_GATEWAY_TOKEN: "t" } as any), "self_hosted");
  assert.equal(embeddingBackend({ GEMINI_API_KEY: "k" } as any), "gemini");
  assert.equal(groundingConfigured({ GEMINI_API_KEY: "k", GEMINI_MODEL: "m" } as any), true);
});
