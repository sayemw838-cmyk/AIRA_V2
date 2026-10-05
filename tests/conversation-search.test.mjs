import assert from "node:assert/strict";
import test from "node:test";
import { filterConversations } from "../src/conversations/conversation-search.js";

const conversations = [
  { id: "a", title: "Research climate policy" },
  { id: "b", title: "Build a portfolio site" },
  { id: "c", title: "" },
];

test("conversation search returns all entries for an empty or whitespace query", () => {
  assert.deepEqual(filterConversations(conversations, ""), conversations);
  assert.deepEqual(filterConversations(conversations, "   "), conversations);
});

test("conversation search matches titles case-insensitively and ignores surrounding spaces", () => {
  assert.deepEqual(filterConversations(conversations, "  CLIMATE "), [conversations[0]]);
});

test("conversation search treats an empty title as Untitled", () => {
  assert.deepEqual(filterConversations(conversations, "untitled"), [conversations[2]]);
});

test("conversation search safely handles non-array input", () => {
  assert.deepEqual(filterConversations(null, "anything"), []);
});
