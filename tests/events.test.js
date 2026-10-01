import test from "node:test";
import assert from "node:assert/strict";
import { AIRA_EVENTS, emitAiraEvent, onAiraEvent, onceAiraEvent } from "../src/core/events.js";

test("voice and agent lifecycle event names are present and unique", () => {
  const names = Object.values(AIRA_EVENTS);
  assert.equal(new Set(names).size, names.length);
  for (const key of [
    "VOICE_INPUT_STARTED",
    "VOICE_TRANSCRIPT_COMPLETED",
    "AGENT_RESPONSE_STARTED",
    "AGENT_TOOL_CALL",
    "AGENT_TOOL_RESULT",
    "VOICE_OUTPUT_STARTED",
    "VOICE_OUTPUT_COMPLETED",
    "VOICE_RESPONSE_CANCELLED",
  ]) assert.equal(typeof AIRA_EVENTS[key], "string");
});

test("event helpers deliver structured details and once listeners fire once", () => {
  const target = new EventTarget();
  const seen = [];
  const unsubscribe = onAiraEvent(AIRA_EVENTS.AGENT_TOOL_CALL, (event) => seen.push(event.detail), target);
  let onceCount = 0;
  onceAiraEvent(AIRA_EVENTS.VOICE_OUTPUT_COMPLETED, () => { onceCount += 1; }, target);

  assert.equal(emitAiraEvent(AIRA_EVENTS.AGENT_TOOL_CALL, { name: "calculator" }, target), true);
  emitAiraEvent(AIRA_EVENTS.VOICE_OUTPUT_COMPLETED, { text: "done" }, target);
  emitAiraEvent(AIRA_EVENTS.VOICE_OUTPUT_COMPLETED, { text: "ignored" }, target);
  assert.deepEqual(seen, [{ name: "calculator" }]);
  assert.equal(onceCount, 1);

  unsubscribe();
  assert.equal(emitAiraEvent(AIRA_EVENTS.AGENT_TOOL_CALL, { name: "run_js" }, target), true);
  assert.deepEqual(seen, [{ name: "calculator" }]);
});
