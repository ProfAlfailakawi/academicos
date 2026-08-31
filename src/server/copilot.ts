import type { CopilotMode, ProjectDNA, WorkspaceArtifact, ProjectEvidence, CopilotCitation } from "../types";

export interface CopilotResponse {
  answer: string;
  citations: CopilotCitation[];
  controls: {
    grounded: boolean;
    defenses: string[];
    blocked?: boolean;
    provider?: string;
  };
  observability: {
    evals: { id: string; status: "pass" | "warn" | "fail"; detail: string }[];
    latencyMs: number;
    promptId: string;
  };
  guidance: string[];
}

export function copilotFeatureFlag(mode: CopilotMode): string {
  switch (mode) {
    case "file_search": return "ProjectCopilotFileSearch";
    case "research": return "ResearchStudioGrounding";
    case "assignment_compile": return "MultimodalAssignmentCompiler";
    case "tutor": return "AdaptiveCopilotTutor";
    case "workspace_function": return "WorkspaceFunctionCalling";
    case "viva_live": return "GeminiLiveViva";
    default: return "ProjectCopilot";
  }
}

export function copilotEnabled(mode: CopilotMode, flagMap: Record<string, boolean>): boolean {
  if (flagMap["ProjectCopilot"] === false) return false;
  const key = copilotFeatureFlag(mode);
  return flagMap[key] !== false;
}

export function shouldBlockCopilot(project: ProjectDNA, mode: CopilotMode, query: string): boolean {
  if (project.aiPolicy?.level === 0) return true;
  return false;
}

export function nativeCopilotResponse(args: {
  mode: CopilotMode;
  query: string;
  project: ProjectDNA;
  artifacts: WorkspaceArtifact[];
  evidence: ProjectEvidence[];
  actor: any;
  grounded: boolean;
}): CopilotResponse {
  return {
    answer: "Initial local answer. The AI provider will update this.",
    citations: [],
    controls: {
      grounded: args.grounded,
      defenses: [],
      provider: "native",
    },
    observability: {
      evals: [],
      latencyMs: 0,
      promptId: `native-${args.mode}`,
    },
    guidance: [],
  };
}

export function buildCopilotPlatformInstruction(project: ProjectDNA, mode: CopilotMode): string {
  return `You are a Project Copilot operating in mode: ${mode}. Adhere strictly to the project's AI policy: Level ${project.aiPolicy?.level}. Ensure academic integrity and sovereignty.`;
}

export function finalizeCopilotRun(response: CopilotResponse, runId: string, usage: any): CopilotResponse {
  return {
    ...response,
    observability: {
      ...response.observability,
      evals: [...response.observability.evals, { id: "recorded", status: "pass", detail: `Run ID: ${runId}` }],
    },
  };
}
