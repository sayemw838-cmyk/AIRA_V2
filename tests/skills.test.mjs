import assert from "node:assert/strict";
import test from "node:test";
import { validateSkillInput, readSkills, writeSkills, saveSkill, setPendingSkill, readPendingSkill, clearPendingSkill, deleteSkill, toggleSkill, exportSkills, importSkills } from "../src/skills/skill-store.js";
import { matchSkills, selectKnowledge, buildSkillContext } from "../src/skills/skill-match.js";

function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
function draft() { return { id: "python-debugging", name: "Python debugging", description: "Use when diagnosing Python errors and failing tests.", instructions: "Reproduce the failure, isolate the smallest case, and explain the fix.", operatorWorkflow: [{ id: "inspect", title: "Inspect the failure", instruction: "Read the traceback or requested project file before proposing a fix.", tool: "read_file", verification: "Confirm the relevant path and failure details were actually returned." }, { id: "verify", title: "Verify the fix", instruction: "Run a focused check or read the changed artifact back.", verification: "Confirm the check result supports the final report." }], knowledge: [{ id: "web-1", text: "The official Python docs describe exceptions and tracebacks.", origin: "web", sourceUrl: "https://docs.python.org/3/tutorial/errors.html", retrievedAt: "2026-10-03T00:00:00.000Z", confidence: "high", timeSensitive: false }, { id: "model-1", text: "Prefer a minimal reproducible example before changing multiple variables.", origin: "model", confidence: "medium", timeSensitive: false }], examples: [{ prompt: "Why does my test fail?", expectedBehavior: "Ask for the traceback and isolate the smallest failing case." }] }; }

test("skill schema requires provenance for web facts and rejects secrets", () => {
  assert.equal(validateSkillInput(draft()).valid, true);
  assert.equal(validateSkillInput({ ...draft(), knowledge: [{ text: "fact", origin: "web" }] }).valid, false);
  assert.equal(validateSkillInput({ ...draft(), instructions: "Use api_key=secret-value" }).valid, false);
  assert.equal(validateSkillInput({ ...draft(), operatorWorkflow: [{ instruction: "Do arbitrary code", tool: "run_js" }] }).valid, false);
  assert.equal(validateSkillInput({ ...draft(), operatorWorkflow: [{ instruction: "Use an unknown capability", tool: "send_email" }] }).valid, false);
});

test("skill lifecycle is local, versioned, and approval-gated", () => {
  const ls = storage();
  assert.deepEqual(readSkills(ls), []);
  setPendingSkill(draft(), ls);
  assert.equal(readSkills(ls).length, 0);
  assert.equal(readPendingSkill(ls).name, "Python debugging");
  const saved = saveSkill(readPendingSkill(ls), ls);
  clearPendingSkill(ls);
  assert.equal(saved.version, 1);
  assert.equal(readPendingSkill(ls), null);
  const updated = saveSkill({ ...saved, instructions: "Updated rules" }, ls);
  assert.equal(updated.version, 2);
  toggleSkill(updated.id, false, ls);
  assert.equal(readSkills(ls)[0].enabled, false);
  deleteSkill(updated.id, ls);
  assert.deepEqual(readSkills(ls), []);
});

test("export and import preserve the skill data without secrets", () => {
  const source = storage();
  saveSkill(draft(), source);
  const exported = exportSkills(source);
  assert.match(exported, /python-debugging/);
  const target = storage();
  assert.equal(importSkills(exported, target).length, 1);
  assert.equal(readSkills(target)[0].knowledge[0].sourceUrl, "https://docs.python.org/3/tutorial/errors.html");
});

test("matching loads at most the requested skills and omits stale time-sensitive facts", () => {
  const skill = draft();
  skill.enabled = true;
  skill.knowledge.push({ id: "stale", text: "Old release fact", origin: "web", sourceUrl: "https://example.com/old", retrievedAt: "2020-01-01T00:00:00.000Z", timeSensitive: true, ttlDays: 1 });
  assert.equal(matchSkills([skill], "debug my Python test").length, 1);
  assert.equal(selectKnowledge(skill, "debug Python", 10, Date.parse("2026-10-03T00:00:00.000Z")).some((item) => item.id === "stale"), false);
  const result = buildSkillContext([skill], "debug Python");
  assert.match(result.context, /Python debugging/);
  assert.match(result.context, /docs.python.org/);
  assert.match(result.context, /OPERATOR WORKFLOW/);
  assert.match(result.context, /Inspect the failure/);
});
