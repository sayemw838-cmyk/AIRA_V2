import { importSkills, readSkills, writeSkills } from "../skills/skill-store.js";
import { normalizeTask } from "../tasks/task-store.js";

export const PORTABLE_SCHEMA = "aira-portable-v1";
export const PORTABLE_WARNING = "AIRA does not sync this data between accounts or devices. Export this local package and import it on the other device. API keys, passwords, tokens, and cloud sessions are never included.";
const TASKS_STORAGE_KEY = "aira_tasks_v1";
const SAFE_SETTINGS = ["aira_user_name", "aira_model", "aira_model_mode", "aira_theme", "aira_motion_style", "aira_animations_enabled", "aira_stt_model", "aira_speak_mode", "aira_speak_speed"];

function parseJson(value, fallback) {
  try { return value == null || value === "" ? fallback : JSON.parse(value); } catch { return fallback; }
}
function readTasks(storage) {
  const raw = parseJson(storage?.getItem(TASKS_STORAGE_KEY), []);
  return (Array.isArray(raw) ? raw : []).map(normalizeTask).slice(-50);
}
function cleanSettings(storage) {
  return Object.fromEntries(SAFE_SETTINGS.flatMap((key) => {
    const value = storage?.getItem(key);
    return value == null ? [] : [[key, String(value).slice(0, 200)]];
  }));
}
function validPackage(source) {
  if (!source || typeof source !== "object") throw new Error("AIRA package must be a JSON object.");
  if (source.schema !== PORTABLE_SCHEMA) throw new Error(`Unsupported AIRA package schema. Expected ${PORTABLE_SCHEMA}.`);
  if (!Array.isArray(source.skills)) throw new Error("AIRA package must contain a skills array.");
  if (source.tasks != null && !Array.isArray(source.tasks)) throw new Error("AIRA package tasks must be an array.");
  return source;
}

export function exportPortablePackage(storage = globalThis.localStorage) {
  return JSON.stringify({
    schema: PORTABLE_SCHEMA,
    packageType: "local-device-transfer",
    exportedAt: new Date().toISOString(),
    warning: PORTABLE_WARNING,
    agents: [
      { id: "operator", name: "Operator Agent", description: "Plans, executes, adapts, and verifies multi-step goals." },
      { id: "research", name: "Research Agent", description: "Plans research, gathers evidence, cross-checks, and cites findings." },
    ],
    skills: readSkills(storage),
    tasks: readTasks(storage),
    settings: cleanSettings(storage),
    excluded: ["API keys", "passwords", "tokens", "Supabase sessions", "browser conversations", "virtual workspace files"],
  }, null, 2);
}

export function importPortablePackage(value, storage = globalThis.localStorage, mode = "merge") {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  const pack = validPackage(parsed);
  if (mode === "replace") {
    storage?.setItem("aira_skills_v1", "[]");
    storage?.setItem(TASKS_STORAGE_KEY, "[]");
  }
  importSkills(pack.skills, storage);
  const skillMap = new Map();
  for (const skill of readSkills(storage)) skillMap.set(skill.id, skill);
  const skills = writeSkills([...skillMap.values()], storage);
  const existingTasks = mode === "replace" ? [] : readTasks(storage);
  const taskMap = new Map(existingTasks.map((task) => [task.id, task]));
  for (const task of pack.tasks || []) taskMap.set(String(task.id || ""), normalizeTask(task));
  const tasks = [...taskMap.values()].filter((task) => task.id).slice(-50);
  storage?.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  for (const [key, value] of Object.entries(pack.settings || {})) if (SAFE_SETTINGS.includes(key)) storage?.setItem(key, String(value).slice(0, 200));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("aira:portable-imported", { detail: { skills, tasks, mode } }));
  return { skills, tasks, agents: Array.isArray(pack.agents) ? pack.agents : [] };
}

export { TASKS_STORAGE_KEY };
