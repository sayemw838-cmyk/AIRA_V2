import assert from "node:assert/strict";
import test from "node:test";
import { supabaseConfig, readSupabaseSession, writeSupabaseSession, skillToSupabaseRow, supabaseRowToSkill, listRemoteSkills, upsertRemoteSkill, syncSkills } from "../src/backend/supabase.js";

function storage() {
  const map = new Map();
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), removeItem: (key) => map.delete(key) };
}
function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}
const session = { access_token: "test-access-token", user: { id: "user-1" } };
const skill = { id: "release-verification-operator", name: "Release Verification Operator", description: "Verify releases.", instructions: "Keep evidence.", operatorWorkflow: [{ id: "report", instruction: "Report evidence.", tool: "read_file", verification: "Read back." }], knowledge: [], examples: [], enabled: true, version: 1, createdAt: "2026-10-03T00:00:00.000Z", updatedAt: "2026-10-03T00:00:00.000Z" };

test("Supabase public configuration is present without a service-role key", () => {
  const config = supabaseConfig();
  assert.equal(config.configured, true);
  assert.match(config.url, /^https:\/\/.*\.supabase\.co$/);
});

test("session storage and skill row mapping preserve ownership boundaries", () => {
  const ls = storage();
  writeSupabaseSession(session, ls);
  assert.deepEqual(readSupabaseSession(ls), session);
  const row = skillToSupabaseRow(skill, session.user.id);
  assert.equal(row.owner_id, "user-1");
  assert.equal(supabaseRowToSkill(row).operatorWorkflow[0].id, "report");
  writeSupabaseSession(null, ls);
  assert.equal(readSupabaseSession(ls), null);
});

test("authenticated remote skill operations use Supabase REST endpoints", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("/rest/v1/skills?select")) return response([skillToSupabaseRow(skill, "user-1")]);
    return response({});
  };
  try {
    const listed = await listRemoteSkills(session);
    assert.equal(listed[0].id, skill.id);
    await upsertRemoteSkill(skill, session);
    assert.equal(calls.some((call) => call.options.method === "POST" && call.url.includes("on_conflict=id")), true);
    const merged = await syncSkills([skill], session);
    assert.equal(merged[0].id, skill.id);
    assert.equal(calls.every((call) => call.options.headers.apikey), true);
    assert.equal(calls.every((call) => call.options.headers.Authorization.includes("test-access-token")), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
