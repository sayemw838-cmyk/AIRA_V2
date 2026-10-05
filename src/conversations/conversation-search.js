export function filterConversations(conversations, query) {
  const items = Array.isArray(conversations) ? conversations : [];
  const needle = String(query ?? "").trim().toLowerCase();
  if (!needle) return items;
  return items.filter((conversation) =>
    String(conversation?.title || "Untitled").toLowerCase().includes(needle)
  );
}
