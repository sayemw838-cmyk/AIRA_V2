import assert from "node:assert/strict";
import test from "node:test";
import { exportPortablePackage, importPortablePackage, PORTABLE_SCHEMA } from "../src/local/portable-store.js";

function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
const skill = { id: "portable-skill", name: "Portable skill", description: "A skill that can move between devices.", instructions: "Use the local workflow and verify the result.", operatorWorkflow: [{ instruction: "Inspect the local context.", tool: "read_file", verification: "Confirm the context was read." }] };

test("portable package includes skills, agents, tasks, and excludes secrets", () => {
  const source = storage();
  source.setItem("aira_tasks_v1", JSON.stringify([{ id: "task-1", objective: "Test transfer", state: "completed", result: "Done" }]));
  source.setItem("aira_api_key", "secret-api-key");
  source.setItem("aira_user_name", "Sayem");
  source.setItem("aira_skills_v1", JSON.stringify([skill]));
  const pack = JSON.parse(exportPortablePackage(source));
  assert.equal(pack.schema, PORTABLE_SCHEMA);
  assert.equal(pack.skills[0].id, "portable-skill");
  assert.equal(pack.tasks[0].id, "task-1");
  assert.equal(pack.agents.some((agent) => agent.id === "operator"), true);
  assert.equal(JSON.stringify(pack).includes("secret-api-key"), false);
  assert.equal(pack.settings.aira_user_name, "Sayem");
});

test("portable package imports skills and task records locally", () => {
  const source = storage();
  source.setItem("aira_skills_v1", JSON.stringify([skill]));
  source.setItem("aira_tasks_v1", JSON.stringify([{ id: "task-1", objective: "Test transfer", state: "completed" }]));
  const target = storage();
  const result = importPortablePackage(exportPortablePackage(source), target);
  assert.equal(result.skills.some((item) => item.id === "portable-skill"), true);
  assert.equal(result.tasks.some((item) => item.id === "task-1"), true);
  assert.equal(JSON.parse(target.getItem("aira_tasks_v1")).length, 1);
});

test("portable package rejects an unknown schema", () => {
  assert.throws(() => importPortablePackage({ schema: "other-v1", skills: [] }, storage()), /Unsupported AIRA package schema/);
});
