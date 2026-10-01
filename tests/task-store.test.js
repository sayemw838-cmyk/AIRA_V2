import test from "node:test";
import assert from "node:assert/strict";

class MemoryStorage {
  #data = new Map();
  getItem(key) { return this.#data.has(String(key)) ? this.#data.get(String(key)) : null; }
  setItem(key, value) { this.#data.set(String(key), String(value)); }
  removeItem(key) { this.#data.delete(String(key)); }
  clear() { this.#data.clear(); }
}

const storage = new MemoryStorage();
const target = new EventTarget();
globalThis.localStorage = storage;
globalThis.window = target;

const store = await import("../src/tasks/task-store.js");
const { createTaskCenter } = await import("../src/tasks/task-center.js");

function reset() {
  storage.clear();
}

test.beforeEach(reset);

test("normalizes legacy tasks without losing the original state", () => {
  const task = store.normalizeTask({ id: "legacy-1", objective: "Old task", state: "completed", steps: ["Write", { title: "Verify", done: true }] });
  assert.equal(task.id, "legacy-1");
  assert.equal(task.state, "completed");
  assert.equal(task.status, "finished");
  assert.equal(task.goal, "Old task");
  assert.equal(task.steps[0].title, "Write");
  assert.equal(task.progress, 50);
  assert.equal(task.activity.length, 0);
});

test("writes and reads a stable task record", () => {
  const task = store.normalizeTask({ id: "task-1", objective: "Prepare close checklist", steps: [{ title: "Collect inputs" }] });
  const written = store.writeTasks([task]);
  const read = store.readTasks();
  assert.equal(written[0].id, "task-1");
  assert.equal(read[0].objective, "Prepare close checklist");
  assert.equal(read[0].retryCount, 0);
  assert.equal(read[0].progress, 0);
});

test("records state transitions and activity events", () => {
  const task = store.writeTasks([{ id: "task-2", objective: "Run analysis" }])[0];
  const working = store.transitionTask(task.id, store.TASK_STATES.working, { message: "Running analysis" });
  assert.equal(working.state, "working");
  assert.equal(working.status, "working");
  assert.equal(working.liveStatus, "Running analysis");
  assert.equal(working.activity.at(-1).type, "state");
  assert.equal(working.activity.at(-1).message, "Running analysis");

  const finished = store.transitionTask(task.id, store.TASK_STATES.finished, { message: "Verified" });
  assert.equal(finished.completedAt !== null, true);
  assert.equal(finished.activity.length, 2);
});

test("supports pause, resume, cancel, result, and retry operations", () => {
  const task = store.writeTasks([{ id: "task-3", objective: "Draft report" }])[0];
  const paused = store.pauseTask(task.id);
  assert.equal(paused.state, "paused");
  assert.equal(paused.pausedAt !== null, true);

  const resumed = store.resumeTask(task.id);
  assert.equal(resumed.state, "working");
  assert.equal(resumed.pausedAt, null);

  const retried = store.incrementTaskRetry(task.id);
  assert.equal(retried.retryCount, 1);
  const withResult = store.appendTaskResult(task.id, "Draft saved", { outcome: "PARTIAL" });
  assert.deepEqual(withResult.resultSchema, { outcome: "PARTIAL" });

  const cancelled = store.cancelTask(task.id);
  assert.equal(cancelled.state, "cancelled");
  assert.equal(cancelled.completedAt !== null, true);
  assert.equal(cancelled.activity.at(-1).type, "cancel");
});

test("focus selection remains independent from task persistence", () => {
  store.setFocusedTaskId("task-focus");
  assert.equal(store.getFocusedTaskId(), "task-focus");
  store.setFocusedTaskId(null);
  assert.equal(store.getFocusedTaskId(), "");
});

test("Task Center action handlers cover focus, status, pause, resume, retry, and cancel", () => {
  const task = store.writeTasks([{ id: "task-controls", objective: "Control test", steps: [{ title: "Work" }] }])[0];
  const list = { innerHTML: "", addEventListener() {} };
  const count = { textContent: "0" };
  const input = { value: "", focus() {}, setSelectionRange() {} };
  const published = [];
  const center = createTaskCenter({
    list,
    count,
    escapeHtml: (value) => String(value),
    input,
    resize() {},
    closeSidebar() {},
    publishTaskState: (...args) => published.push(args),
    taskStates: { working: "working", paused: "paused", cancelled: "cancelled", finished: "finished" },
  });

  center.handleAction("focus", task.id);
  assert.equal(store.getFocusedTaskId(), task.id);
  assert.equal(published.at(-1)[0], "working");

  center.handleAction("status", task.id);
  assert.equal(input.value, `/tasks status ${task.id}`);

  center.handleAction("pause", task.id);
  assert.equal(store.getTask(task.id).state, "paused");
  assert.equal(published.at(-1)[0], "paused");

  center.handleAction("resume", task.id);
  assert.equal(store.getTask(task.id).state, "working");
  assert.equal(input.value, "/tasks Control test");

  center.handleAction("retry", task.id);
  assert.equal(input.value, "/tasks Control test");

  center.handleAction("cancel", task.id);
  assert.equal(store.getTask(task.id).state, "cancelled");
  assert.equal(published.at(-1)[0], "cancelled");
});
