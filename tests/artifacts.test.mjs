import test from "node:test";
import assert from "node:assert/strict";
import {
  appendFileMarker, stripFileMarker, collectArtifactPaths, extractHtmlDocument,
  buildPreviewDoc, buildFixPrompt, isPreviewable,
} from "../src/artifacts/artifact-viewer.js";

test("file marker round-trips paths, including commas and spaces", () => {
  const stored = appendFileMarker("Built it.", ["games/snake.html", "notes/a, b.md"]);
  const parsed = stripFileMarker(stored);
  assert.equal(parsed.text, "Built it.");
  assert.deepEqual(parsed.paths, ["games/snake.html", "notes/a, b.md"]);
});

test("no paths means no marker, and plain text is untouched", () => {
  assert.equal(appendFileMarker("hi", []), "hi");
  assert.deepEqual(stripFileMarker("hi"), { text: "hi", paths: [] });
});

test("collectArtifactPaths keeps only successful write/edit calls, deduped", () => {
  const calls = [{ name: "write_file" }, { name: "edit_file", arguments: { path: "a.html" } }, { name: "write_file" }, { name: "read_file" }, { name: "write_file" }];
  const results = [
    { name: "write_file", success: true, output: { path: "a.html" } },
    { name: "edit_file", success: true, output: { path: "a.html" } },
    { name: "write_file", success: false, error: "too large" },
    { name: "read_file", success: true, output: { path: "x.md" } },
    { name: "write_file", success: true, output: { path: "b.js" } },
  ];
  assert.deepEqual(collectArtifactPaths(calls, results), ["a.html", "b.js"]);
});

test("extractHtmlDocument only accepts full documents", () => {
  const doc = "<!doctype html><html><body>" + "x".repeat(300) + "</body></html>";
  assert.equal(extractHtmlDocument("text\n```html\n" + doc + "\n```\nmore"), doc);
  assert.equal(extractHtmlDocument("```html\n<div>snippet</div>\n```"), null);
  assert.equal(extractHtmlDocument("no code"), null);
});

test("preview doc injects capture script inside <head>, after the doctype", () => {
  const out = buildPreviewDoc("<!DOCTYPE html><html><head><title>t</title></head><body>hi</body></html>");
  assert.ok(out.startsWith("<!DOCTYPE html>"));
  assert.ok(out.indexOf("aira-artifact") > out.indexOf("<head>"));
  assert.ok(out.indexOf("aira-artifact") < out.indexOf("<title>"));
});

test("preview doc handles html-without-head, doctype-only, bare fragments and svg", () => {
  const noHead = buildPreviewDoc("<html><body>x</body></html>");
  assert.ok(noHead.includes("<head>"));
  assert.ok(noHead.includes("name=\"viewport\""));
  assert.ok(noHead.includes("aira-artifact"));
  const doctypeOnly = buildPreviewDoc("<!doctype html><p>x</p>");
  assert.ok(doctypeOnly.startsWith("<!doctype html>"));
  assert.ok(doctypeOnly.includes("name=\"viewport\""));
  const fragment = buildPreviewDoc("<p>x</p>");
  assert.ok(fragment.startsWith("<meta charset=\"utf-8\">") && fragment.includes("aira-artifact"));
  const svg = buildPreviewDoc("<svg viewBox='0 0 1 1'></svg>");
  assert.ok(svg.includes("<svg") && svg.includes("aira-artifact"));
});

test("injected capture script is valid JavaScript", () => {
  const out = buildPreviewDoc("<html><head></head></html>");
  const code = out.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Function(code));
});

test("previewable types and fix prompt", () => {
  assert.ok(isPreviewable("a/b.HTML") && isPreviewable("x.svg") && !isPreviewable("x.md"));
  const prompt = buildFixPrompt("g.html", ["ReferenceError: x is not defined (line 4)"]);
  assert.ok(prompt.includes("g.html") && prompt.includes("ReferenceError") && prompt.includes("edit_file"));
});
