export const TASK_STATES = Object.freeze({
  PLANNING: "planning",
  PLANNED: "planned",
  CHECKING: "checking",
  EXECUTING: "executing",
  WAITING_FOR_INPUT: "waiting_for_input",
  WAITING_FOR_APPROVAL: "waiting_for_approval",
  BLOCKED: "blocked",
  UNKNOWN: "unknown",
  COMPLETED: "completed",
  PARTIAL: "partial",
  CANCELLED: "cancelled",
  FAILED: "failed",
  ERROR: "error",
  RATE_LIMITED: "ratelimited",
});

const KNOWN_STATES = new Set(Object.values(TASK_STATES));
const STATE_ALIASES = Object.freeze({
  done: TASK_STATES.COMPLETED,
  finished: TASK_STATES.COMPLETED,
  success: TASK_STATES.COMPLETED,
  in_progress: TASK_STATES.EXECUTING,
  running: TASK_STATES.EXECUTING,
  working: TASK_STATES.EXECUTING,
  thinking: TASK_STATES.PLANNING,
  searching: TASK_STATES.CHECKING,
  rate_limited: TASK_STATES.RATE_LIMITED,
});
const ACTIVE_STATES = new Set([
  TASK_STATES.PLANNING,
  TASK_STATES.CHECKING,
  TASK_STATES.EXECUTING,
]);
const HUD_STATE_BY_TASK_STATE = Object.freeze({
  [TASK_STATES.PLANNING]: "thinking",
  [TASK_STATES.PLANNED]: "waiting_for_input",
  [TASK_STATES.CHECKING]: "working",
  [TASK_STATES.EXECUTING]: "working",
  [TASK_STATES.WAITING_FOR_INPUT]: "waiting_for_input",
  [TASK_STATES.WAITING_FOR_APPROVAL]: "waiting_for_approval",
  [TASK_STATES.BLOCKED]: "error",
  [TASK_STATES.UNKNOWN]: "error",
  [TASK_STATES.COMPLETED]: "finished",
  [TASK_STATES.PARTIAL]: "partial",
  [TASK_STATES.CANCELLED]: "cancelled",
  [TASK_STATES.FAILED]: "error",
  [TASK_STATES.ERROR]: "error",
  [TASK_STATES.RATE_LIMITED]: "ratelimited",
});

export function normalizeTaskState(value, fallback = TASK_STATES.UNKNOWN) {
  const key = String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!key) return fallback;
  const state = STATE_ALIASES[key] || key;
  return KNOWN_STATES.has(state) ? state : fallback;
}

export function isTaskActive(state) {
  return ACTIVE_STATES.has(normalizeTaskState(state, ""));
}

export function taskHudState(state) {
  const normalized = normalizeTaskState(state);
  return HUD_STATE_BY_TASK_STATE[normalized] || "thinking";
}
