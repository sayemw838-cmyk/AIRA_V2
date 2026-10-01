import test from "node:test";
import assert from "node:assert/strict";
import { retryAsync } from "../src/core/retry.js";

test("retryAsync retries transient failures with exponential backoff", async () => {
  const delays = [];
  let calls = 0;
  const result = await retryAsync(async () => {
    calls += 1;
    if (calls < 3) throw Object.assign(new Error("temporary"), { status: 503 });
    return "ok";
  }, {
    maxRetries: 2,
    baseDelayMs: 10,
    shouldRetry: (error) => error.status === 503,
    sleep: async (ms) => delays.push(ms),
  });
  assert.equal(result, "ok");
  assert.equal(calls, 3);
  assert.deepEqual(delays, [10, 20]);
});

test("retryAsync stops after its retry budget", async () => {
  let calls = 0;
  await assert.rejects(
    retryAsync(async () => {
      calls += 1;
      throw Object.assign(new Error("bad request"), { status: 400 });
    }, {
      maxRetries: 2,
      shouldRetry: () => true,
      sleep: async () => {},
    }),
    /bad request/,
  );
  assert.equal(calls, 3);
});

test("retryAsync does not retry an aborted operation", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  await assert.rejects(
    retryAsync(async () => { calls += 1; return "never"; }, { signal: controller.signal }),
    (error) => error.name === "AbortError",
  );
  assert.equal(calls, 0);
});
