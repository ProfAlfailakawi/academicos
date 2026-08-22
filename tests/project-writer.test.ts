import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectDNA } from "../src/server/project-engine";
import { buildVariationProfile, composeProjectDocument, decideProjectWritingAccess, inspectProjectDraft } from "../src/server/project-writer";

function project(level = 2, needsConfirmation = false) {
  return buildProjectDNA({
    title: "تحليل السوق الكويتي", course: "BUS 342", projectType: "Research report", academicDomain: "Business", complexity: "medium", collaborationMode: "individual",
    requiredActions: ["RESEARCH", "WRITE", "DEFEND"], requiredSkills: ["Analysis"], learningOutcomes: ["Use evidence"], deliverables: [{ title: "Report", format: "DOCX" }],
    requirements: [{ label: "Length", value: "12 pages", category: "format", confidence: "high" }],
    rubric: [{ title: "Evidence", description: "Uses credible sources", weighting: 50 }, { title: "Analysis", description: "Compares alternatives", weighting: 50 }],
    aiPolicy: { level: level as any, summary: level >= 4 ? "AI drafting allowed with disclosure" : "Planning and review only", needsConfirmation, provenance: needsConfirmation ? "extracted_unverified" : "course_policy" }, riskFlags: [],
  }, { userId: "owner", tenantId: "individual_owner" });
}

test("variation is stable per student and different across students", () => {
  const p = project();
  assert.deepEqual(buildVariationProfile(p, "student-a", "secret"), buildVariationProfile(p, "student-a", "secret"));
  assert.notEqual(buildVariationProfile(p, "student-a", "secret").id, buildVariationProfile(p, "student-b", "secret").id);
});

test("500 students receive unique deterministic writer fingerprints and varied structures", () => {
  const p = project();
  const profiles = Array.from({ length: 500 }, (_, index) =>
    buildVariationProfile(p, `student-${index}`, "large-sample-secret"),
  );
  assert.equal(new Set(profiles.map((profile) => profile.id)).size, 500);
  assert.ok(
    new Set(
      profiles.map((profile) =>
        [profile.argumentShape, profile.structureRhythm, profile.explanationStyle, profile.exampleLens].join("|"),
      ),
    ).size > 250,
  );
});

test("full disclosed submission is blocked until policy is confirmed and permissive", () => {
  assert.throws(() => decideProjectWritingAccess(project(2, true), "disclosed_submission"), (error: any) => error.code === "PROJECT_WRITING_POLICY_BLOCKED");
  assert.equal(decideProjectWritingAccess(project(4), "disclosed_submission").fullDraft, true);
  assert.equal(decideProjectWritingAccess(project(1), "policy_strict").fullDraft, false);
});

test("writer creates a complete sectioned scaffold without inventing sources", async () => {
  const document = await composeProjectDocument({ project: project(), userId: "student-a", request: { mode: "write", assistanceMode: "practice", language: "العربية", desiredPages: 10, academicTone: "clear" }, variationSecret: "secret" });
  assert.ok(document.sections.length >= 6);
  assert.ok(document.sections.every((section) => section.content.length > 100));
  assert.equal(document.bibliography.length, 0);
  assert.ok(document.integrityWarnings.some((warning) => warning.includes("مصادر")));
});

test("Project X-Ray flags missing evidence and repetitive prose", () => {
  const repeated = "هذه جملة تحليلية طويلة لكنها مكررة ولا تحتوي على مصدر موثق يدعم الادعاء المطروح داخل المشروع";
  const report = inspectProjectDraft(project(), `# مقدمة\n${repeated}. ${repeated}. ${repeated}.`);
  assert.ok(report.scores.sources < 60);
  assert.ok(report.findings.some((finding) => finding.category === "sources"));
  assert.ok(report.findings.some((finding) => finding.category === "language"));
});
