function words(value) { return new Set(String(value || "").toLowerCase().match(/[a-z0-9][a-z0-9+#.-]{1,}/g) || []); }
function scoreSkill(skill, query) {
  const queryWords = words(query);
  const haystack = words(`${skill.name} ${skill.description}`);
  let score = 0;
  for (const word of queryWords) if (haystack.has(word)) score += word.length > 5 ? 2 : 1;
  return score;
}
export function matchSkills(skills, query, limit = 3) {
  return (Array.isArray(skills) ? skills : []).filter((skill) => skill?.enabled !== false)
    .map((skill) => ({ skill, score: scoreSkill(skill, query) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(a.skill.name).localeCompare(String(b.skill.name)))
    .slice(0, Math.max(1, limit)).map((item) => item.skill);
}
export function selectKnowledge(skill, query, limit = 6, now = Date.now()) {
  const q = words(query);
  return (Array.isArray(skill?.knowledge) ? skill.knowledge : []).filter((item) => {
    if (item.timeSensitive && item.retrievedAt) {
      const age = now - new Date(item.retrievedAt).getTime();
      if (Number.isFinite(age) && age > Number(item.ttlDays || 30) * 86400000) return false;
    }
    return true;
  }).map((item) => ({ item, score: [...q].filter((word) => words(item.text).has(word)).length }))
    .sort((a, b) => b.score - a.score || (a.item.origin === "web" ? -1 : 1))
    .slice(0, Math.max(1, limit)).map((entry) => entry.item);
}
export function buildSkillContext(skills, query, limits = {}) {
  const matched = matchSkills(skills, query, limits.maxSkills || 3);
  const blocks = matched.map((skill) => {
    const knowledge = selectKnowledge(skill, query, limits.maxKnowledge || 6);
    const facts = knowledge.map((item) => `- ${item.text}${item.origin === "web" && item.sourceUrl ? ` [Source: ${item.sourceUrl}]` : ` [${item.origin} knowledge]`}`).join("\n");
    const workflow = (Array.isArray(skill.operatorWorkflow) ? skill.operatorWorkflow : []).map((step, index) => `${index + 1}. ${step.title}: ${step.instruction}${step.tool ? ` [preferred tool: ${step.tool}]` : ""}${step.verification ? ` [verify: ${step.verification}]` : ""}`).join("\n");
    return `SKILL: ${skill.name}\nWHEN TO USE: ${skill.description}\nINSTRUCTIONS: ${skill.instructions}${workflow ? `\nOPERATOR WORKFLOW (follow only when the Operator Agent is running):\n${workflow}` : ""}${facts ? `\nRELEVANT KNOWLEDGE:\n${facts}` : ""}`;
  });
  return { matched, context: blocks.join("\n\n") };
}
