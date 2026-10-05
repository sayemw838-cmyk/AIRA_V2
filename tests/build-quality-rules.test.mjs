import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { BUILD_QUALITY_RULES } from "../src/prompt/build-quality-rules.js";

const rules = BUILD_QUALITY_RULES.toLowerCase();
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("shared build policy covers requirements and existing-project context", () => {
  assert.match(rules, /acceptance checklist/);
  assert.match(rules, /explicit non-goals/);
  assert.match(rules, /existing project/);
  assert.match(rules, /preserve working behavior/);
  assert.match(rules, /do not force single-file architecture/);
});

test("shared build policy gives honest and targeted file-tool guidance", () => {
  assert.match(rules, /write_file for a new file/);
  assert.match(rules, /read_file before making a focused edit_file/);
  assert.match(rules, /without claiming a file was saved/);
});

test("shared build policy covers complete behavior, safety, and accessibility", () => {
  assert.match(rules, /dead controls/);
  assert.match(rules, /loading\/empty\/success\/error/);
  assert.match(rules, /secrets/);
  assert.match(rules, /untrusted input/);
  assert.match(rules, /keyboard support/);
  assert.match(rules, /touch targets of at least 44px/);
  assert.match(rules, /never call preventdefault on a button's touchstart/);
});

test("shared build policy covers broad verification and honest reporting", () => {
  assert.match(rules, /read the actual changed files back/);
  assert.match(rules, /focused tests/);
  assert.match(rules, /typecheck/);
  assert.match(rules, /never claim a check that was not run/);
  assert.match(rules, /visual\/browser behavior was not verified/);
});

test("shared build policy preserves Snake-specific regression lessons", () => {
  assert.match(rules, /spawn food only on free cells/);
  assert.match(rules, /reject immediate reversals/);
  assert.match(rules, /run the game loop only while playing/);
});

test("all model modes receive the policy through their shared system-prompt rules", () => {
  assert.match(appSource, /import \{ BUILD_QUALITY_RULES \} from "\.\/prompt\/build-quality-rules\.js"/);
  const sharedBlock = appSource.match(/const sharedPromptRules = `([\s\S]*?)`;\s+const builtInBlock/);
  assert.ok(sharedBlock, "sharedPromptRules block should remain identifiable");
  assert.match(sharedBlock[1], /\$\{BUILD_QUALITY_RULES\}/);
  assert.equal((appSource.match(/\$\{sharedPromptRules\}/g) || []).length, 2);
});
