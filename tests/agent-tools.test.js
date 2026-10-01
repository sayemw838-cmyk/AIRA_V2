import test from "node:test";
import assert from "node:assert/strict";
import { AIRA_VERSION, MAX_ITERATIONS } from "../src/core/constants.js";
import { createToolRegistry, getTime, safeCalculate, webFetch } from "../src/agent/tools.js";

test("AIRA exposes the approved three-tool loop contract", () => {
  assert.match(AIRA_VERSION, /^2\.3/);
  assert.equal(MAX_ITERATIONS, 5);
  const registry = createToolRegistry();
  assert.deepEqual(registry.names(), ["get_time", "calculator", "web_fetch"]);
  assert.deepEqual(registry.definitions().map((item) => item.function.name), ["get_time", "calculator", "web_fetch"]);
});

test("calculator parses safe arithmetic without dynamic code evaluation", () => {
  assert.deepEqual(safeCalculate("15% * 200"), { success: true, output: 30 });
  assert.deepEqual(safeCalculate("sqrt(81) + min(4, 9)"), { success: true, output: 13 });
  assert.deepEqual(safeCalculate("2 ^ 3"), { success: true, output: 8 });
  assert.equal(safeCalculate("2 + process.exit()").success, false);
  assert.equal(safeCalculate("1; globalThis.pwned = true").success, false);
  assert.equal(safeCalculate("fetch('https://example.com')").success, false);
});

test("get_time returns deterministic UTC and validates IANA timezones", () => {
  const now = new Date("2026-01-02T03:04:05.000Z");
  const result = getTime({ timezone: "UTC" }, now);
  assert.equal(result.success, true);
  assert.equal(result.output.iso, "2026-01-02T03:04:05.000Z");
  assert.equal(result.output.unix, 1767323045);
  assert.equal(getTime({ timezone: "Not/AZone" }, now).success, false);
});

test("web_fetch validates URL, extracts readable text, and limits response size", async () => {
  const response = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: () => "text/html" },
    text: async () => "<html><script>ignore()</script><h1>Hello</h1><p>World &amp; friends</p></html>",
  };
  const result = await webFetch({ url: "https://example.com/page" }, { fetchImpl: async () => response, now: () => new Date("2026-01-02T03:04:05.000Z") });
  assert.equal(result.success, true);
  assert.equal(result.output.text, "Hello World & friends");
  assert.equal(result.output.fetched_at, "2026-01-02T03:04:05.000Z");
  assert.equal((await webFetch({ url: "file:///tmp/a" }, { fetchImpl: async () => response })).success, false);
});

test("web_fetch reports CORS-style browser failures instead of pretending success", async () => {
  const result = await webFetch({ url: "https://blocked.example" }, { fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  assert.equal(result.success, false);
  assert.match(result.error, /CORS|Netlify Function/i);
});

test("registry executes only approved tools and passes injected browser dependencies", async () => {
  const registry = createToolRegistry({
    now: () => new Date("2026-01-02T03:04:05.000Z"),
    fetchImpl: async () => ({ ok: true, status: 200, statusText: "OK", headers: { get: () => "text/plain" }, text: async () => "plain text" }),
  });
  assert.equal((await registry.execute("calculator", { expression: "6 * 7" })).output, 42);
  assert.equal((await registry.execute("get_time", { timezone: "UTC" })).output.unix, 1767323045);
  assert.equal((await registry.execute("web_fetch", { url: "https://example.com" })).output.text, "plain text");
  assert.equal((await registry.execute("read_file", { path: "secret.txt" })).success, false);
});
