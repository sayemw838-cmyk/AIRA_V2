import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { isCodeArtifactPath, reviewCodeArtifact } from "../src/codegen/code-review.js";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("recognizes common source and runnable artifact extensions", () => {
  for (const path of ["page.html", "app.tsx", "lib.mjs", "styles.css", "config.json", "script.py"]) {
    assert.equal(isCodeArtifactPath(path), true, path);
  }
  assert.equal(isCodeArtifactPath("notes.md"), false);
});

test("flags common generated-HTML defects and malformed inline JavaScript", () => {
  const report = reviewCodeArtifact("snake.html", `<!doctype html>
<html><head><title>Snake</title></head><body>
<button id="move">Move</button><script>
// TODO: finish this
console.log("debug");
alert("Game over");
button.addEventListener("touchstart", event => event.preventDefault());
const broken = ;
</script></body></html>`);

  assert.equal(report.kind, "heuristic-static");
  assert.equal(report.status, "review-needed");
  assert.deepEqual(
    report.findings.map(({ code }) => code),
    ["unfinished-marker", "debug-log", "blocking-alert", "touch-click-cancellation", "missing-viewport", "javascript-syntax"],
  );
  assert.ok(report.checks.includes("inline JavaScript"));
});

test("does not flag a clean responsive HTML artifact or execute its code", () => {
  const report = reviewCodeArtifact("page.html", `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Finished page</title></head><body><main><h1>Hello</h1></main>
<script>throw new Error("this source must not run");</script></body></html>`);
  assert.equal(report.status, "no-findings");
  assert.ok(report.checks.includes("inline JavaScript"));
});

test("reports JavaScript syntax errors without invoking source", () => {
  assert.equal(reviewCodeArtifact("good.js", "const value = 2; return value;").status, "no-findings");
  const report = reviewCodeArtifact("bad.js", "const value = ;");
  assert.deepEqual(report.findings.map(({ code }) => code), ["javascript-syntax"]);
  assert.equal(reviewCodeArtifact("module.js", "import value from './value.js';").skipped.length, 1);
});

test("validates JSON files without executing source", () => {
  assert.equal(reviewCodeArtifact("data.json", "{\"ok\":true}").status, "no-findings");
  assert.deepEqual(reviewCodeArtifact("data.json", "{broken").findings.map(({ code }) => code), ["invalid-json"]);
  assert.equal(reviewCodeArtifact("unsafe.js", "throw new Error('must not run')").status, "no-findings");
});

test("skips prose files instead of treating them as generated code", () => {
  assert.deepEqual(reviewCodeArtifact("readme.md", "TODO console.log alert(\"x\")"), {
    kind: "heuristic-static", status: "skipped", checks: [], skipped: [], findings: [],
  });
});

test("successful code writes/edits are reviewed and unresolved warnings trigger bounded repair", () => {
  assert.match(appSource, /reviewCodeArtifact\(args\.path, file\.output\.content\)/);
  assert.match(appSource, /code_review: codeReview/);
  assert.match(appSource, /codeReviewRepairRounds < 2/);
  assert.match(appSource, /AUTOMATED CODE REVIEW/);
  assert.match(appSource, /Automated source review still has advisory findings that were not resolved/);
});
