const SKILLS_STORAGE_KEY = "aira_skills_v1";
const PENDING_SKILL_KEY = "aira_pending_skill_v1";
const MAX_SKILLS = 50;
const MAX_KNOWLEDGE = 100;
const MAX_WORKFLOW_STEPS = 12;
const OPERATOR_TOOLS = new Set(["calculator", "current_time", "list_files", "read_file", "write_file", "delete_file", "run_js", "switch_model", "browser_search"]);
const SECRET_PATTERN = /(?:api[_ -]?key|secret|password|token|sk-[A-Za-z0-9_-]{12,})/i;
const HARMFUL_PATTERN = /(?:make|build|create|deploy).{0,30}(?:malware|ransomware|credential theft|phishing kit|weapon|explosive)/i;

function nowISO() { return new Date().toISOString(); }
function text(value, max = 1000) { return String(value ?? "").trim().slice(0, max); }
function slugify(value) {
  const slug = text(value, 80).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug || "skill";
}
function uniqueId(prefix = "item") { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`; }
function normalizeKnowledge(item) {
  const source = item && typeof item === "object" ? item : {};
  const origin = ["web", "model", "user"].includes(source.origin) ? source.origin : "model";
  const url = origin === "web" && /^https?:\/\/[^\s]+$/i.test(String(source.sourceUrl || "")) ? String(source.sourceUrl) : "";
  return {
    id: text(source.id, 100) || uniqueId("knowledge"),
    text: text(source.text, 1200),
    origin,
    ...(url ? { sourceUrl: url } : {}),
    retrievedAt: text(source.retrievedAt, 50) || nowISO(),
    confidence: ["high", "medium", "low"].includes(source.confidence) ? source.confidence : "medium",
    timeSensitive: !!source.timeSensitive,
    ttlDays: Math.max(1, Math.min(3650, Number(source.ttlDays) || 30)),
  };
}
function normalizeWorkflowStep(item) {
  const source = item && typeof item === "object" ? item : {};
  const tool = text(source.tool, 60).toLowerCase();
  return {
    id: text(source.id, 100) || uniqueId("step"),
    title: text(source.title, 160) || "Operator step",
    instruction: text(source.instruction, 1000),
    ...(tool ? { tool } : {}),
    verification: text(source.verification, 700),
  };
}
export function validateSkillInput(skill) {
  const source = skill && typeof skill === "object" ? skill : {};
  const name = text(source.name, 120);
  const description = text(source.description, 500);
  const instructions = text(source.instructions, 4000);
  const errors = [];
  if (!name) errors.push("A skill name is required.");
  if (!description) errors.push("A skill description is required.");
  if (!instructions) errors.push("Skill instructions are required.");
  if (SECRET_PATTERN.test(JSON.stringify(source))) errors.push("Skills cannot contain API keys, secrets, passwords, or tokens.");
  if (HARMFUL_PATTERN.test(`${name} ${description} ${instructions}`)) errors.push("This skill purpose is not supported.");
  const knowledge = Array.isArray(source.knowledge) ? source.knowledge : [];
  for (const item of knowledge) {
    if (!text(item?.text, 1200)) errors.push("Every knowledge entry needs text.");
    if (item?.origin === "web" && !/^https?:\/\/[^\s]+$/i.test(String(item?.sourceUrl || ""))) errors.push("Every web fact needs a retrieved HTTP(S) source URL.");
  }
  const workflow = Array.isArray(source.operatorWorkflow) ? source.operatorWorkflow : [];
  for (const step of workflow) {
    if (!text(step?.instruction, 1000)) errors.push("Every Operator workflow step needs an instruction.");
    if (step?.tool && !OPERATOR_TOOLS.has(String(step.tool).toLowerCase())) errors.push(`Unsupported Operator workflow tool: ${step.tool}`);
    if (String(step?.tool || "").toLowerCase() === "run_js") errors.push("Operator workflows cannot directly request run_js; use a named local tool instead.");
  }
  return { valid: errors.length === 0, errors };
}
export function normalizeSkill(skill) {
  const source = skill && typeof skill === "object" ? skill : {};
  const createdAt = text(source.createdAt, 50) || nowISO();
  return {
    id: text(source.id, 120) || slugify(source.name),
    name: text(source.name, 120) || "Untitled skill",
    description: text(source.description, 500),
    version: Math.max(1, Number(source.version) || 1),
    createdAt,
    updatedAt: text(source.updatedAt, 50) || createdAt,
    enabled: source.enabled !== false,
    instructions: text(source.instructions, 4000),
    operatorWorkflow: (Array.isArray(source.operatorWorkflow) ? source.operatorWorkflow : []).map(normalizeWorkflowStep).filter((step) => step.instruction).slice(0, MAX_WORKFLOW_STEPS),
    knowledge: (Array.isArray(source.knowledge) ? source.knowledge : []).map(normalizeKnowledge).filter((item) => item.text).slice(0, MAX_KNOWLEDGE),
    examples: (Array.isArray(source.examples) ? source.examples : []).map((item) => ({ prompt: text(item?.prompt, 500), expectedBehavior: text(item?.expectedBehavior, 700) })).filter((item) => item.prompt).slice(0, 10),
    changelog: Array.isArray(source.changelog) ? source.changelog.slice(-20) : [],
  };
}
export function readSkills(storage = globalThis.localStorage) {
  try {
    const raw = JSON.parse(storage?.getItem(SKILLS_STORAGE_KEY) || "[]");
    return (Array.isArray(raw) ? raw : []).map(normalizeSkill).slice(-MAX_SKILLS);
  } catch { return []; }
}
export function writeSkills(skills, storage = globalThis.localStorage) {
  const normalized = (Array.isArray(skills) ? skills : []).map(normalizeSkill).slice(-MAX_SKILLS);
  storage?.setItem(SKILLS_STORAGE_KEY, JSON.stringify(normalized));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("aira:skills-changed", { detail: { skills: normalized } }));
  return normalized;
}
export function saveSkill(skill, storage = globalThis.localStorage) {
  const normalized = normalizeSkill(skill);
  const check = validateSkillInput(normalized);
  if (!check.valid) throw new Error(check.errors.join(" "));
  const existing = readSkills(storage);
  const index = existing.findIndex((item) => item.id === normalized.id);
  if (index >= 0) existing[index] = { ...normalized, version: existing[index].version + 1, createdAt: existing[index].createdAt, updatedAt: nowISO(), changelog: [...existing[index].changelog, { version: existing[index].version, changedAt: nowISO(), note: "Updated through AIRA" }].slice(-20) };
  else existing.push(normalized);
  return writeSkills(existing, storage).find((item) => item.id === normalized.id);
}
export function setPendingSkill(skill, storage = globalThis.localStorage) { const normalized = normalizeSkill(skill); storage?.setItem(PENDING_SKILL_KEY, JSON.stringify(normalized)); return normalized; }
export function readPendingSkill(storage = globalThis.localStorage) { try { const parsed = JSON.parse(storage?.getItem(PENDING_SKILL_KEY) || "null"); return parsed ? normalizeSkill(parsed) : null; } catch { return null; } }
export function clearPendingSkill(storage = globalThis.localStorage) { storage?.removeItem(PENDING_SKILL_KEY); }
export function deleteSkill(id, storage = globalThis.localStorage) { return writeSkills(readSkills(storage).filter((item) => item.id !== String(id)), storage); }
export function toggleSkill(id, enabled, storage = globalThis.localStorage) { return writeSkills(readSkills(storage).map((item) => item.id === String(id) ? { ...item, enabled: !!enabled, updatedAt: nowISO() } : item), storage); }
export function exportSkills(storage = globalThis.localStorage) { return JSON.stringify({ schema: "aira-skills-v1", exportedAt: nowISO(), skills: readSkills(storage) }, null, 2); }
export function importSkills(json, storage = globalThis.localStorage) { const parsed = typeof json === "string" ? JSON.parse(json) : json; const incoming = Array.isArray(parsed) ? parsed : parsed?.skills; if (!Array.isArray(incoming)) throw new Error("Skill import must contain a skills array."); for (const item of incoming) { const check = validateSkillInput(item); if (!check.valid) throw new Error(check.errors.join(" ")); } return writeSkills([...readSkills(storage), ...incoming], storage); }
export { SKILLS_STORAGE_KEY, PENDING_SKILL_KEY };
