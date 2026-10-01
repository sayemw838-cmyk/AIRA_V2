import {
  getFocusedTaskId,
  readTasks,
  setFocusedTaskId,
  writeTasks,
} from "./task-store.js";

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
      const active = !["completed", "cancelled", "failed", "error"].includes(task.state);
      const action = active
        ? `<button type="button" data-task-action="cancel" data-task-id="${escapeHtml(task.id)}">Cancel</button>`
        : `<button type="button" data-task-action="retry" data-task-id="${escapeHtml(task.id)}">Retry</button>`;
      return `<article class="task-center-card ${state} ${focusedId === task.id ? "focused" : ""}" data-task-id="${escapeHtml(task.id)}">
        <div class="task-center-title">${escapeHtml(task.objective)}</div>
        <div class="task-center-meta"><span class="task-center-state">${escapeHtml(taskStateLabel(task.state))}</span><span>${progress.done}/${progress.total} steps</span></div>
        <div class="task-center-progress" aria-label="${progress.percent}% complete"><span style="width:${progress.percent}%"></span></div>
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

  function stateForFocusedTask(state) {
    if (state === "completed") return taskStates.finished;
    if (state === "cancelled") return taskStates.cancelled;
    if (["failed", "error"].includes(state)) return taskStates.error;
    if (state === "waiting_for_approval") return taskStates.waiting_for_approval;
    if (["waiting_for_input", "planned"].includes(state)) return taskStates.waiting_for_input;
    if (["planning", "checking", "executing"].includes(state)) return taskStates.working;
    if (state === "partial") return taskStates.partial;
    return taskStates.thinking;
  }

  function handleAction(action, id) {
    const tasks = readTasks();
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    if (action === "focus") {
      setFocusedTaskId(id);
      render(tasks);
      publishTaskState(stateForFocusedTask(task.state), task.objective, { taskId: id });
    } else if (action === "status") {
      openTaskInComposer(`/tasks status ${id}`);
    } else if (action === "retry") {
      openTaskInComposer(`/tasks ${task.objective}`);
    } else if (action === "cancel") {
      task.state = "cancelled";
      task.result = "Cancelled from Task Center before any consequential action was taken.";
      if (getActiveTaskId() === id && getAbortController()) getAbortController().abort();
      writeTasks(tasks);
      if (getFocusedTaskId() === id) publishTaskState(taskStates.cancelled, "Task cancelled", { taskId: id });
    }
  }

  list?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-task-action]");
    if (!button) return;
    handleAction(button.dataset.taskAction, button.dataset.taskId);
  });
  window.addEventListener("aira:tasks-changed", (event) => render(event.detail?.tasks || readTasks()));
  window.addEventListener("aira:task-focus-changed", () => render());

  return { render, handleAction };
}
