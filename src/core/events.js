export const AIRA_EVENTS = Object.freeze({
  TASK_STATE: "aira:task-state",
  TASKS_CHANGED: "aira:tasks-changed",
  TASK_FOCUS_CHANGED: "aira:task-focus-changed",
  CONVERSATION_CHANGED: "aira:conversation-changed",
  MODEL_CHANGED: "aira:model-changed",
  VOICE_STATE: "aira:voice-state",
  VOICE_INPUT_STARTED: "aira:voice-input-started",
  VOICE_TRANSCRIPT_PARTIAL: "aira:voice-transcript-partial",
  VOICE_TRANSCRIPT_COMPLETED: "aira:voice-transcript-completed",
  AGENT_RESPONSE_STARTED: "aira:agent-response-started",
  AGENT_TOOL_CALL: "aira:agent-tool-call",
  AGENT_TOOL_RESULT: "aira:agent-tool-result",
  VOICE_OUTPUT_STARTED: "aira:voice-output-started",
  VOICE_OUTPUT_DELTA: "aira:voice-output-delta",
  VOICE_OUTPUT_COMPLETED: "aira:voice-output-completed",
  VOICE_RESPONSE_CANCELLED: "aira:voice-response-cancelled",
  APPROVAL_REQUESTED: "aira:approval-requested",
});

function eventTarget(target = globalThis.window) {
  if (!target || typeof target.dispatchEvent !== "function") return null;
  return target;
}

export function emitAiraEvent(type, detail = {}, target = globalThis.window) {
  const destination = eventTarget(target);
  if (!destination) return false;
  destination.dispatchEvent(new CustomEvent(type, { detail }));
  return true;
}

export function onAiraEvent(type, listener, target = globalThis.window) {
  const destination = eventTarget(target);
  if (!destination || typeof destination.addEventListener !== "function") return () => {};
  destination.addEventListener(type, listener);
  return () => destination.removeEventListener(type, listener);
}

export function onceAiraEvent(type, listener, target = globalThis.window) {
  const destination = eventTarget(target);
  if (!destination || typeof destination.addEventListener !== "function") return () => {};
  const wrapped = (event) => {
    destination.removeEventListener(type, wrapped);
    listener(event);
  };
  destination.addEventListener(type, wrapped);
  return () => destination.removeEventListener(type, wrapped);
}
