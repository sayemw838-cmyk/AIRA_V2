import assert from "node:assert/strict";
import test from "node:test";
import { isTaskActive, normalizeTaskState, taskHudState, TASK_STATES } from "../src/tasks/task-state.js";
import { createTaskCenter } from "../src/tasks/task-center.js";
import { normalizeTask } from "../src/tasks/task-store.js";
import { createRunCard } from "../src/tasks/run-card.js";

const CANONICAL_STATES = Object.values(TASK_STATES);

test("known task states stay canonical and legacy spellings normalize consistently", () => {
  for (const state of CANONICAL_STATES) assert.equal(normalizeTaskState(state), state);
  assert.equal(normalizeTaskState("finished"), TASK_STATES.COMPLETED);
  assert.equal(normalizeTaskState("DONE"), TASK_STATES.COMPLETED);
  assert.equal(normalizeTaskState("in progress"), TASK_STATES.EXECUTING);
  assert.equal(normalizeTaskState("rate-limited"), TASK_STATES.RATE_LIMITED);
  assert.equal(normalizeTaskState("invented_state"), TASK_STATES.UNKNOWN);
  assert.equal(normalizeTaskState("invented_state", TASK_STATES.PARTIAL), TASK_STATES.PARTIAL);
  assert.equal(isTaskActive("invented_state"), false);
});

test("only execution phases are active; planned and partial outcomes are not cancellable runs", () => {
  for (const state of ["planning", "checking", "executing", "thinking", "searching", "working", "in_progress"]) {
    assert.equal(isTaskActive(state), true, state);
  }
  for (const state of ["planned", "partial", "waiting_for_input", "waiting_for_approval", "blocked", "completed", "finished", "cancelled", "failed", "error"]) {
    assert.equal(isTaskActive(state), false, state);
  }
});

test("task storage normalizes unknown and legacy states before persisting them", () => {
  assert.equal(normalizeTask({ id: "bad", state: "unrecognized" }).state, TASK_STATES.UNKNOWN);
  assert.equal(normalizeTask({ id: "missing" }).state, TASK_STATES.PLANNING);
  assert.equal(normalizeTask({ id: "legacy", state: "finished" }).state, TASK_STATES.COMPLETED);
  assert.equal(normalizeTask({ id: "partial", state: "partial" }).state, TASK_STATES.PARTIAL);
});

test("Task Center offers Cancel only for execution phases", () => {
  const previousWindow = globalThis.window;
  const previousStorage = globalThis.localStorage;
  globalThis.window = { addEventListener() {} };
  globalThis.localStorage = { getItem() { return ""; } };
  try {
    const list = { innerHTML: "", addEventListener() {} };
    const count = { textContent: "" };
    const center = createTaskCenter({
      list,
      count,
      escapeHtml: (value) => String(value),
      input: {},
      resize() {},
      closeSidebar() {},
      publishTaskState() {},
      taskStates: {
        thinking: "thinking",
        working: "working",
        finished: "finished",
        cancelled: "cancelled",
        error: "error",
        waiting_for_input: "waiting_for_input",
        waiting_for_approval: "waiting_for_approval",
        partial: "partial",
      },
    });
    center.render([
      { id: "planning", objective: "Planning", state: "planning", steps: [] },
      { id: "checking", objective: "Checking", state: "checking", steps: [] },
      { id: "executing", objective: "Executing", state: "executing", steps: [] },
      { id: "planned", objective: "Planned", state: "planned", steps: [] },
      { id: "partial", objective: "Partial", state: "partial", steps: [] },
      { id: "done", objective: "Done", state: "completed", steps: [] },
      { id: "unknown", objective: "Unknown", state: "future_state", steps: [] },
    ]);
    const cards = [...list.innerHTML.matchAll(/<article\b[\s\S]*?<\/article>/g)].map(([html]) => html);
    assert.equal(cards.length, 7);
    const cardById = Object.fromEntries(cards.map((html) => [
      html.match(/data-task-id="([^"]+)"/)?.[1],
      html,
    ]));
    for (const id of ["planning", "checking", "executing"]) {
      assert.match(cardById[id], /data-task-action="cancel"/, id);
    }
    for (const id of ["planned", "partial", "done", "unknown"]) {
      assert.match(cardById[id], /data-task-action="retry"/, id);
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
  }
});

class FakeClassList {
  constructor(initial = "") {
    this.values = new Set(String(initial).split(/\s+/).filter(Boolean));
  }
  add(...names) { for (const name of names) this.values.add(name); }
  remove(...names) { for (const name of names) this.values.delete(name); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : !!force;
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }
}

class FakeElement {
  constructor() {
    this.attributes = {};
    this.listeners = {};
    this.children = [];
    this.innerHTML = "";
    this.textContent = "";
    this.classList = new FakeClassList();
    this.statusLabel = null;
  }
  set className(value) { this.classList = new FakeClassList(value); }
  get className() { return [...this.classList.values].join(" "); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  append(...children) { this.children.push(...children); }
  querySelector(selector) {
    if (selector !== ".run-card-status-label") return null;
    if (!this.statusLabel) this.statusLabel = new FakeElement();
    return this.statusLabel;
  }
}

test("run cards share active-state classification and minimize non-running states", () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => new FakeElement() };
  try {
    for (const state of ["planning", "checking", "executing", "planned", "partial", "completed", "finished", "waiting_for_approval", "future_state"]) {
      const card = createRunCard();
      card.update(`**Task task-1 — ${state}**\n\n**Goal:** Lifecycle test\n\n○ Verify the result`);
      const active = isTaskActive(state);
      assert.equal(card.element.classList.contains("running"), active, state);
      assert.equal(card.element.classList.contains("collapsed"), !active, state);
    }
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("Operator run cards have a distinct kind and title", () => {
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: () => new FakeElement() };
  try {
    const card = createRunCard({ kind: "operator" });
    card.update("**Task task-operator — executing**\n\n**Goal:** Operator: calculate a result\n\n● Execute");
    assert.match(card.element.className, /run-card--operator/);
    assert.equal(card.element.children[0].children[1].children[0].textContent, "Operator Agent");
    assert.equal(card.element.children[0].children[1].children[1].textContent, "Operator: calculate a result");
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("the HUD keeps the completed/finished vocabulary boundary in one mapping", () => {
  assert.equal(taskHudState("completed"), "finished");
  assert.equal(taskHudState("finished"), "finished");
  assert.equal(taskHudState("partial"), "partial");
  assert.equal(taskHudState("waiting_for_approval"), "waiting_for_approval");
});
