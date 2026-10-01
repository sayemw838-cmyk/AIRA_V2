import {
  cancelTask,
  getFocusedTaskId,
  pauseTask,
  readTasks,
  resumeTask,
  setFocusedTaskId,
} from "./task-store.js";
import { AIRA_EVENTS, onAiraEvent } from "../core/events.js";

function taskProgress(task) {
  const steps = Array.isArray(task?.steps) ? task.steps : [];
  const done = steps.filter((step) => step.done).length;
  return { done, total: steps.length, percent: steps.length ? Math.round((done / steps.length) * 100) : 0 };
}

function taskStateLabel(state) {
  return String(state || "unknown").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function createTaskCenter({
  list,
  count,
  escapeHtml,
  input,
  resize,
  closeSidebar,
  publishTaskState,
  taskStates,
  getActiveTaskId = () => null,
  getAbortController = () => null,
}) {
  function render(tasks = readTasks()) {
    if (!list || !count) return;
    const ordered = tasks.slice().reverse();
    const focusedId = getFocusedTaskId();
    count.textContent = String(ordered.length);
    if (!ordered.length) {
      list.innerHTML = '<div class="task-center-empty">No tasks yet.<br>Use the task buttons above the composer to begin.</div>';
      return;
    }
    list.innerHTML = ordered.map((task) => {
      const progress = taskProgress(task);
      const state = String(task.state || "unknown").replace(/[^a-z0-9_-]/gi, "_");
      const active = !["completed", "finished", "cancelled", "failed", "error", "partial", "blocked"].includes(task.state);
      const pauseAction = task.state === "paused"
        ? `<button type="button" data-task-action="resume" data-task-id="${escapeHtml(task.id)}">Resume</button>`
        : active
          ? `<button type="button" data-task-action="pause" data-task-id="${escapeHtml(task.id)}">Pause</button>`
          : "";
      const action = active || task.state === "paused"
        ? `${pauseAction}<button type="button" data-task-action="cancel" data-task-id="${escapeHtml(task.id)}">Cancel</button>`
        : `<button type="button" data-task-action="retry" data-task-id="${escapeHtml(task.id)}">Retry</button>`;
      const currentStep = Array.isArray(task.steps) ? task.steps[task.currentStep] : null;
      const activity = Array.isArray(task.activity) ? task.activity.at(-1) : null;
      return `<article class="task-center-card ${state} ${focusedId === task.id ? "focused" : ""}" data-task-id="${escapeHtml(task.id)}">
        <div class="task-center-title">${escapeHtml(task.objective)}</div>
        <div class="task-center-meta"><span class="task-center-state">${escapeHtml(taskStateLabel(task.status || task.state))}</span><span>${progress.done}/${progress.total} steps</span></div>
        <div class="task-center-progress" aria-label="${progress.percent}% complete"><span style="width:${progress.percent}%"></span></div>
        ${currentStep ? `<div class="task-center-meta"><span>Current step</span><span>${escapeHtml(currentStep.title)}</span></div>` : ""}
        ${activity?.message ? `<div class="task-center-meta"><span>Latest activity</span><span>${escapeHtml(activity.message)}</span></div>` : ""}
        <div class="task-center-actions">
          <button type="button" data-task-action="focus" data-task-id="${escapeHtml(task.id)}">${focusedId === task.id ? "Focused" : "Focus"}</button>
          <button type="button" data-task-action="status" data-task-id="${escapeHtml(task.id)}">View</button>
          ${action}
        </div>
      </article>`;
    }).join("");
  }

  function openTaskInComposer(text) {
    input.value = text;
    input.focus();
    resize();
    input.setSelectionRange(input.value.length, input.value.length);
    closeSidebar();
  }

  function handleAction(action, id) {
    const tasks = readTasks();
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    if (action === "focus") {
      setFocusedTaskId(id);
      render(tasks);
      publishTaskState(task.state === "completed" ? taskStates.finished : taskStates.working, task.objective, { taskId: id });
    } else if (action === "status") {
      openTaskInComposer(`/tasks status ${id}`);
    } else if (action === "retry") {
      openTaskInComposer(`/tasks ${task.objective}`);
    } else if (action === "pause") {
      pauseTask(id);
      if (getActiveTaskId() === id && getAbortController()) getAbortController().abort();
      if (getFocusedTaskId() === id) publishTaskState(taskStates.paused || taskStates.working, "Task paused", { taskId: id });
    } else if (action === "resume") {
      resumeTask(id);
      openTaskInComposer(`/tasks ${task.objective}`);
    } else if (action === "cancel") {
      cancelTask(id, "Cancelled from Task Center before any consequential action was taken.");
      if (getActiveTaskId() === id && getAbortController()) getAbortController().abort();
      if (getFocusedTaskId() === id) publishTaskState(taskStates.cancelled, "Task cancelled", { taskId: id });
    }
  }

  list?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-task-action]");
    if (!button) return;
    handleAction(button.dataset.taskAction, button.dataset.taskId);
  });
  onAiraEvent(AIRA_EVENTS.TASKS_CHANGED, (event) => render(event.detail?.tasks || readTasks()));
  onAiraEvent(AIRA_EVENTS.TASK_FOCUS_CHANGED, () => render());

  return { render, handleAction };
}
