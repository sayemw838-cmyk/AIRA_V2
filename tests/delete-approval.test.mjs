import assert from "node:assert/strict";
import test from "node:test";
import { executeApprovedTaskDeletion, executeModelToolCall } from "../src/tasks/tool-authorization.js";

test("model-originated delete_file calls are blocked before the deletion executor runs", () => {
  const calls = [];
  const result = executeModelToolCall("delete_file", { path: "notes/private.txt" }, (...args) => {
    calls.push(args);
    return { success: true };
  });

  assert.equal(result.success, false);
  assert.match(result.error, /explicit.*approve/i);
  assert.deepEqual(calls, []);
});

test("only a pending approved task can execute its exact file deletion", async () => {
  const calls = [];
  const executeTool = async (...args) => {
    calls.push(args);
    return { success: true, output: "deleted" };
  };

  const denied = await executeApprovedTaskDeletion({
    state: "executing",
    pendingApproval: { action: "delete_file", path: "notes/private.txt" },
  }, executeTool);
  assert.equal(denied.success, false);
  assert.deepEqual(calls, []);

  const approved = await executeApprovedTaskDeletion({
    state: "waiting_for_approval",
    pendingApproval: { action: "delete_file", path: "notes/private.txt" },
  }, executeTool);
  assert.deepEqual(approved, { success: true, output: "deleted" });
  assert.deepEqual(calls, [["delete_file", { path: "notes/private.txt" }]]);
});
