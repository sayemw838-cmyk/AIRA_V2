const TASKS_STORAGE_KEY = "aira_tasks_v1";
const FOCUSED_TASK_KEY = "aira_focused_task";

export function taskId() {
  return "task-" + new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14) + "-" + Math.random().toString(36).slice(2, 6);
}

export function normalizeTask(task) {
  const source = task && typeof task === "object" ? task : {};
  return {
    ...source,
    id: String(source.id || taskId()),
    objective: String(source.objective || "Untitled task"),
    state: String(source.state || "planning"),
    createdAt: source.createdAt || new Date().toISOString(),
    updatedAt: source.updatedAt || source.createdAt || new Date().toISOString(),
    steps: Array.isArray(source.steps)
      ? source.steps.map((step) => ({
          title: String(step?.title || "Untitled step"),
          done: !!step?.done,
        }))
      : [],
    result: String(source.result || ""),
    liveStatus: String(source.liveStatus || ""),
  };
}

export function readTasks() {
  try {
    const raw = JSON.parse(localStorage.getItem(TASKS_STORAGE_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(normalizeTask) : [];
  } catch {
    return [];
  }
}

export function writeTasks(tasks) {
  const normalized = (Array.isArray(tasks) ? tasks : [])
    .map(normalizeTask)
    .map((task) => ({ ...task, updatedAt: new Date().toISOString() }))
    .slice(-50);
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent("aira:tasks-changed", {
    detail: { tasks: normalized, updatedAt: new Date().toISOString() },
  }));
  return normalized;
}

export function getFocusedTaskId() {
  return localStorage.getItem(FOCUSED_TASK_KEY) || "";
}

export function setFocusedTaskId(id) {
  if (id) localStorage.setItem(FOCUSED_TASK_KEY, String(id));
  else localStorage.removeItem(FOCUSED_TASK_KEY);
  window.dispatchEvent(new CustomEvent("aira:task-focus-changed", {
    detail: { taskId: id ? String(id) : null },
  }));
}

export { TASKS_STORAGE_KEY, FOCUSED_TASK_KEY };
