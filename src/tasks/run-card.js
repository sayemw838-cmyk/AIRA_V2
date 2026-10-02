/* Collapsible live run card for /tasks, /skills and /agent runs.
   The card stays expanded while a run is active so progress is visible,
   then minimizes itself when the final result arrives. Clicking the header
   expands or collapses it again at any time. Each run kind gets its own
   accent and label so an Agent run never looks like a Skill or a Task. */

import { isTaskActive } from "./task-state.js";

const KIND_META = {
  task: {
    label: "Task",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.5 6 1.5 1.5L7.5 5"/><path d="M11 6h9.5"/><path d="m3.5 12 1.5 1.5L7.5 11"/><path d="M11 12h9.5"/><path d="m3.5 18 1.5 1.5L7.5 17"/><path d="M11 18h9.5"/></svg>',
  },
  skill: {
    label: "Skill",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5c2.6-1.4 5.2-1.4 8.5 0v13c-3.3-1.4-5.9-1.4-8.5 0z"/><path d="M20.5 6.5c-2.6-1.4-5.2-1.4-8.5 0v13c3.3-1.4 5.9-1.4 8.5 0z"/><path d="M12 6.5v13"/></svg>',
  },
  agent: {
    label: "Agent",
    icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m14.8 9.2-2 4.1-4.1 2 2-4.1z"/><path d="M12 3.5V5M20.5 12H19M12 19v1.5M5 12H3.5"/></svg>',
  },
};

/* Reads the structured fields out of a taskSummary() markdown block. */
function parseSummary(text) {
  const t = String(text || "");
  const stateMatch = t.match(/\*\*Task\s+\S+\s+[—-]\s+([^*]+?)\*\*/);
  const liveMatch = t.match(/\*Live status:\s*([^*]+?)\*/);
  const goalMatch = t.match(/\*\*Goal:\*\*\s*([^\n]+)/);
  const stepsDone = (t.match(/^✓ /gm) || []).length;
  const stepsTotal = stepsDone + (t.match(/^○ /gm) || []).length;
  return {
    state: stateMatch ? stateMatch[1].trim() : "",
    live: liveMatch ? liveMatch[1].trim() : "",
    goal: goalMatch ? goalMatch[1].trim() : "",
    stepsDone,
    stepsTotal,
  };
}

export function createRunCard({ kind = "task", renderMarkdown } = {}) {
  const meta = KIND_META[kind] || KIND_META.task;
  const render = typeof renderMarkdown === "function" ? renderMarkdown : (t) => String(t ?? "");

  const card = document.createElement("article");
  card.className = "run-card run-card--" + (KIND_META[kind] ? kind : "task") + " running";

  const head = document.createElement("button");
  head.type = "button";
  head.className = "run-card-head";
  head.setAttribute("aria-expanded", "true");

  const icon = document.createElement("span");
  icon.className = "run-card-icon";
  icon.innerHTML = meta.icon;

  const headText = document.createElement("span");
  headText.className = "run-card-headtext";
  const kindEl = document.createElement("span");
  kindEl.className = "run-card-kind";
  kindEl.textContent = meta.label;
  const title = document.createElement("span");
  title.className = "run-card-title";
  title.textContent = kind === "agent" ? "Agent run" : kind === "skill" ? "Skill plan" : "Task run";
  headText.append(kindEl, title);

  const state = document.createElement("span");
  state.className = "run-card-state";
  state.textContent = "Working";

  const chevron = document.createElement("span");
  chevron.className = "run-card-chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

  head.append(icon, headText, state, chevron);

  const status = document.createElement("div");
  status.className = "run-card-status";
  status.innerHTML = '<span class="run-card-spin" aria-hidden="true"></span><span class="run-card-status-label">Starting…</span>';

  const body = document.createElement("div");
  body.className = "run-card-body";

  const summary = document.createElement("div");
  summary.className = "run-card-summary";

  card.append(head, status, body, summary);

  let manualToggle = false;
  let collapsed = false;

  function setCollapsed(next) {
    collapsed = !!next;
    card.classList.toggle("collapsed", collapsed);
    head.setAttribute("aria-expanded", String(!collapsed));
  }

  head.addEventListener("click", () => {
    manualToggle = true;
    setCollapsed(!collapsed);
  });

  function update(text) {
    const info = parseSummary(text);
    if (info.goal) title.textContent = info.goal;
    if (info.state) state.textContent = info.state;
    const running = (info.state && isTaskActive(info.state)) || (!info.state && card.classList.contains("running"));
    card.classList.toggle("running", running);
    state.classList.toggle("done", !running && !!info.state);
    status.querySelector(".run-card-status-label").textContent = info.live || (running ? "Working…" : (info.state || "Done"));
    body.innerHTML = render(text);
    const bits = [];
    if (info.stepsTotal) bits.push(info.stepsDone + "/" + info.stepsTotal + " steps");
    bits.push(info.live || info.state || "Done");
    summary.textContent = bits.join(" · ");
    // Auto-minimize as soon as a final state arrives, unless the user took manual control.
    if (!manualToggle && !collapsed && !running) setCollapsed(true);
    return info;
  }

  function collapse() {
    manualToggle = false;
    card.classList.remove("running");
    setCollapsed(true);
  }

  function expand() {
    manualToggle = false;
    setCollapsed(false);
  }

  return { element: card, update, collapse, expand };
}
