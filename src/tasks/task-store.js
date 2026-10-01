import { AIRA_EVENTS, emitAiraEvent } from "../core/events.js";
import { readJSON, readStorage, removeStorage, writeJSON, writeStorage } from "../core/storage.js";

const TASKS_STORAGE_KEY = "aira_tasks_v1";
const FOCUSED_TASK_KEY = "aira_focused_task";
const MAX_TASKS = 50;

export const TASK_STATES = Object.freeze({
  idle: "idle",
  planning: "planning",
  thinking: "thinking",
  working: "working",
  searching: "searching",
  waiting_for_input: "waiting_for_input",
  waiting_for_approval: "waiting_for_approval",
  paused: "paused",
  error: "error",
  ratelimited: "ratelimited",
  finished: "finished",
  completed: "completed",
  cancelled: "cancelled",
  failed: "failed",
  partial: "partial",
  blocked: "blocked",
  executing: "executing",
});

const LEGACY_TO_STATUS = Object.freeze({
  planning: TASK_STATES.thinking,
  executing: TASK_STATES.working,
  completed: TASK_STATES.finished,
  failed: TASK_STATES.error,
  partial: TASK_STATES.error,
  blocked: TASK_STATES.waiting_for_approval,
});

const TERMINAL_STATES = new Set([
  TASK_STATES.finished,
  TASK_STATES.completed,
  TASK_STATES.cancelled,
  TASK_STATES.failed,
  TASK_STATES.error,
  TASK_STATES.partial,
  TASK_STATES.blocked,
]);

function nowISO() {
  return new Date().toISOString();
}

export function taskId() {
  return "task-" + new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + Math.random().toString(36).slice(2, 6);
}

function normalizeStep(step) {
  if (typeof step === "string") return { id: taskId() + "-step", title: step, done: false };
  const source = step && typeof step === "object" ? step : {};
  return {
    ...source,
    id: String(source.id || taskId() + "-step"),
    title: String(source.title || "Untitled step"),
    done: !!source.done,
    state: String(source.state || (source.done ? TASK_STATES.finished : TASK_STATES.idle)),
    startedAt: source.startedAt || null,
    completedAt: source.completedAt || null,
  };
}

function normalizeActivity(item) {
  const source = item && typeof item === "object" ? item : {};
  return {
    ...source,
    id: String(source.id || taskId() + "-event"),
    type: String(source.type || "status"),
    message: String(source.message || ""),
    state: source.state ? String(source.state) : null,
    createdAt: source.createdAt || nowISO(),
  };
}

export function progressForTask(task) {
  const steps = Array.isArray(task?.steps) ? task.steps : [];
  const done = steps.filter((step) => step.done).length;
  const total = steps.length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

export function normalizeTask(task) {
  const source = task && typeof task === "object" ? task : {};
  const createdAt = source.createdAt || nowISO();
  const state = String(source.state || TASK_STATES.planning);
  const status = String(source.status || LEGACY_TO_STATUS[state] || state);
  const steps = Array.isArray(source.steps) ? source.steps.map(normalizeStep) : [];
  const progress = progressForTask({ steps });
  return {
    ...source,
    id: String(source.id || taskId()),
    objective: String(source.objective || source.goal || "Untitled task"),
    goal: String(source.goal || source.objective || "Untitled task"),
    owner: String(source.owner || "user"),
    state,
    status,
    currentStep: Number.isInteger(source.currentStep) ? Math.max(0, source.currentStep) : 0,
    progress: Number.isFinite(source.progress) ? Math.max(0, Math.min(100, source.progress)) : progress.percent,
    steps,
    activity: Array.isArray(source.activity) ? source.activity.map(normalizeActivity).slice(-100) : [],
    model: source.model ? String(source.model) : null,
    provider: source.provider ? String(source.provider) : null,
    retryCount: Number.isInteger(source.retryCount) ? Math.max(0, source.retryCount) : 0,
    createdAt,
    updatedAt: source.updatedAt || createdAt,
    startedAt: source.startedAt || null,
    completedAt: source.completedAt || null,
    pausedAt: source.pausedAt || null,
    result: String(source.result || ""),
    resultSchema: source.resultSchema && typeof source.resultSchema === "object" ? source.resultSchema : null,
    liveStatus: String(source.liveStatus || ""),
  };
}

export function readTasks() {
  const raw = readJSON(TASKS_STORAGE_KEY, []);
  return Array.isArray(raw) ? raw.map(normalizeTask) : [];
}

export function writeTasks(tasks) {
  const normalized = (Array.isArray(tasks) ? tasks : [])
    .map(normalizeTask)
    .map((task) => ({ ...task, updatedAt: nowISO() }))
    .slice(-MAX_TASKS);
  writeJSON(TASKS_STORAGE_KEY, normalized);
  emitAiraEvent(AIRA_EVENTS.TASKS_CHANGED, {
    tasks: normalized,
    updatedAt: nowISO(),
  });
  return normalized;
}

export function getTask(id, tasks = readTasks()) {
  return tasks.find((task) => task.id === String(id)) || null;
}

export function updateTask(id, patch = {}, tasks = readTasks()) {
  const targetId = String(id);
  let found = false;
  const next = tasks.map((task) => {
    if (task.id !== targetId) return task;
    found = true;
    return normalizeTask({ ...task, ...patch, id: targetId });
  });
  return found ? writeTasks(next).find((task) => task.id === targetId) : null;
}

export function addTaskActivity(id, event = {}, tasks = readTasks()) {
  const task = getTask(id, tasks);
  if (!task) return null;
  const activity = normalizeActivity(event);
  return updateTask(id, { activity: [...task.activity, activity], liveStatus: activity.message }, tasks);
}

export function transitionTask(id, nextState, details = {}, tasks = readTasks()) {
  const task = getTask(id, tasks);
  if (!task) return null;
  const state = String(nextState || TASK_STATES.idle);
  const timestamp = nowISO();
  const terminal = TERMINAL_STATES.has(state);
  const activity = normalizeActivity({
    type: details.type || "state",
    message: details.message || state.replace(/_/g, " "),
    state,
    createdAt: timestamp,
  });
  const patch = {
    ...details,
    state,
    status: LEGACY_TO_STATUS[state] || state,
    updatedAt: timestamp,
    activity: [...task.activity, activity],
    liveStatus: String(details.message || task.liveStatus || state),
    completedAt: terminal ? (task.completedAt || timestamp) : null,
    pausedAt: state === TASK_STATES.paused ? timestamp : null,
  };
  return updateTask(id, patch, tasks);
}

export function appendTaskResult(id, result, resultSchema = null, tasks = readTasks()) {
  return updateTask(id, {
    result: String(result || ""),
    resultSchema: resultSchema && typeof resultSchema === "object" ? resultSchema : null,
  }, tasks);
}

export function incrementTaskRetry(id, tasks = readTasks()) {
  const task = getTask(id, tasks);
  return task ? updateTask(id, { retryCount: task.retryCount + 1 }, tasks) : null;
}

export function pauseTask(id, reason = "Paused by the user", tasks = readTasks()) {
  return transitionTask(id, TASK_STATES.paused, { message: reason, type: "pause" }, tasks);
}

export function resumeTask(id, tasks = readTasks()) {
  const task = getTask(id, tasks);
  if (!task) return null;
  return transitionTask(id, TASK_STATES.working, { message: "Resumed", type: "resume" }, tasks);
}

export function cancelTask(id, reason = "Cancelled by the user", tasks = readTasks()) {
  return transitionTask(id, TASK_STATES.cancelled, { message: reason, type: "cancel" }, tasks);
}

export function getFocusedTaskId() {
  return readStorage(FOCUSED_TASK_KEY, "") || "";
}

export function setFocusedTaskId(id) {
  if (id) writeStorage(FOCUSED_TASK_KEY, String(id));
  else removeStorage(FOCUSED_TASK_KEY);
  emitAiraEvent(AIRA_EVENTS.TASK_FOCUS_CHANGED, { taskId: id ? String(id) : null });
}

export { TASKS_STORAGE_KEY, FOCUSED_TASK_KEY, MAX_TASKS };
