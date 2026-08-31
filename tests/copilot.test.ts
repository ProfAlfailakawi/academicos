import test from "node:test";
import assert from "node:assert/strict";
import {
  copilotEnabled,
  copilotFeatureFlag,
  shouldBlockCopilot,
  nativeCopilotResponse,
  buildCopilotPlatformInstruction,
  finalizeCopilotRun,
} from "../src/server/copilot";

test("copilotFeatureFlag maps mode to flag", () => {
  assert.equal(copilotFeatureFlag("file_search"), "ProjectCopilotFileSearch");
  assert.equal(copilotFeatureFlag("research"), "ResearchStudioGrounding");
});

test("copilotEnabled respects global and specific flags", () => {
  assert.equal(copilotEnabled("file_search", { ProjectCopilot: true, ProjectCopilotFileSearch: true }), true);
  assert.equal(copilotEnabled("file_search", { ProjectCopilot: false, ProjectCopilotFileSearch: true }), false);
  assert.equal(copilotEnabled("file_search", { ProjectCopilot: true, ProjectCopilotFileSearch: false }), false);
});

test("shouldBlockCopilot checks AI policy", () => {
  assert.equal(shouldBlockCopilot({ aiPolicy: { level: 0 } } as any, "file_search", "query"), true);
  assert.equal(shouldBlockCopilot({ aiPolicy: { level: 5 } } as any, "file_search", "query"), false);
});

test("nativeCopilotResponse returns proper format", () => {
  const resp = nativeCopilotResponse({ mode: "file_search", query: "", project: {} as any, artifacts: [], evidence: [], actor: {}, grounded: false });
  assert.equal(resp.controls.grounded, false);
});

test("finalizeCopilotRun adds runId to evals", () => {
  const resp = nativeCopilotResponse({ mode: "file_search", query: "", project: {} as any, artifacts: [], evidence: [], actor: {}, grounded: false });
  const fin = finalizeCopilotRun(resp, "run-123", {});
  assert.ok(fin.observability.evals.some(e => e.detail.includes("run-123")));
});
