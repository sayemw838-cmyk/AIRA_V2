import test from "node:test";
import assert from "node:assert/strict";
import { createToolRegistry, currentTime, restrictedJavaScript, safeCalculate } from "../src/agent/tools.js";

test("calculator evaluates supported math and blocks injection", () => {
  assert.deepEqual(safeCalculate("15% * 200"), { success: true, output: 30 });
  assert.equal(safeCalculate("2 + process.exit() ").success, false);
  assert.equal(safeCalculate("1; globalThis.pwned = true").success, false);
});

test("restricted JavaScript supports offline logic and rejects dangerous APIs", () => {
  const result = restrictedJavaScript("console.log('ok'); return Math.sqrt(81);");
  assert.equal(result.success, true);
  assert.equal(result.output.result, 9);
  assert.deepEqual(result.output.logs, ["ok"]);
  assert.equal(restrictedJavaScript("return fetch('https://example.com');").success, false);
  assert.equal(restrictedJavaScript("return document.title;").success, false);
});

test("current time returns stable UTC shape", () => {
  const result = currentTime({ timezone: "UTC" }, new Date("2026-01-02T03:04:05.000Z"));
  assert.equal(result.success, true);
  assert.equal(result.output.iso, "2026-01-02 03:04:05 UTC");
  assert.equal(result.output.unix, 1767323045);
});

test("registry exposes schemas and safe local tools", async () => {
  const files = new Map([["notes/a.md", { path: "notes/a.md", content: "hello" }]]);
  const calls = [];
  const registry = createToolRegistry({
    workspace: {
      async list() { calls.push("list"); return { success: true, output: [...files.values()] }; },
      async read(path) { calls.push(["read", path]); return files.has(path) ? { success: true, output: files.get(path) } : { success: false, error: "not found" }; },
      async write(path, content) { calls.push(["write", path]); files.set(path, { path, content }); return { success: true, output: { path } }; },
      async delete(path) { calls.push(["delete", path]); files.delete(path); return { success: true, output: { deleted: path } }; },
    },
    approval: async (request) => request.path === "notes/a.md",
  });

  assert.deepEqual(registry.names(), ["calculator", "current_time", "list_files", "read_file", "write_file", "delete_file", "run_js"]);
  assert.equal(registry.definitions().length, 7);
  assert.equal((await registry.execute("calculator", { expression: "6 * 7" })).output, 42);
  assert.equal((await registry.execute("list_files")).success, true);
  assert.equal((await registry.execute("read_file", { path: "notes/a.md" })).output.content, "hello");
  assert.equal((await registry.execute("write_file", { path: "notes/b.md", content: "draft" })).success, true);
  assert.equal((await registry.execute("delete_file", { path: "notes/a.md" })).success, true);
  assert.deepEqual(calls.at(-1), ["delete", "notes/a.md"]);
});

test("deletion stays blocked without exact approval", async () => {
  let deleted = false;
  const registry = createToolRegistry({
    workspace: { async delete() { deleted = true; return { success: true }; } },
    approval: async () => false,
  });
  const result = await registry.execute("delete_file", { path: "notes/a.md" });
  assert.equal(result.success, false);
  assert.equal(result.approvalRequired.path, "notes/a.md");
  assert.equal(deleted, false);
});

test("unknown tools and malformed arguments fail safely", async () => {
  const registry = createToolRegistry();
  assert.equal((await registry.execute("not_real")).success, false);
  assert.equal((await registry.execute("read_file", {})).error, "Virtual workspace is not available");
  assert.equal((await registry.execute("write_file", { path: "a.txt", content: 3 })).error, "Virtual workspace is not available");
});
