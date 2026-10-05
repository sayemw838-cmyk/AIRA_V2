const CODE_FILE_RE = /\.(?:html?|[cm]?js|jsx|tsx?|css|json|py|rb|go|java|cs|php|sh|sql|vue|svelte)$/i;
const STATIC_MODULE_SYNTAX_RE = /^\s*(?:import\s+(?!\()|export\s)/m;
const UNFINISHED_MARKER_RE = /(?:^|[\W_])(?:TODO|FIXME|TBD)(?=$|[\W_])|lorem ipsum|your api key|replace with your/i;
const DYNAMIC_CODE_EXECUTION_RE = /\beval\s*\(|\bnew\s+Function\s*\(/i;

export function isCodeArtifactPath(path) {
  return CODE_FILE_RE.test(String(path || ""));
}

function compileWithoutRunning(source) {
  if (STATIC_MODULE_SYNTAX_RE.test(source)) return { skipped: "ES module syntax requires a module-aware checker." };
  try {
    // The new function is compiled, never invoked; generated code is not executed here.
    new Function("async function __airaSyntaxProbe(){\n" + source + "\n}");
    return { checked: true };
  } catch (error) {
    if (error?.name === "EvalError") return { skipped: "Browser policy disallowed dynamic syntax compilation." };
    return { error: String(error?.message || error).slice(0, 180) };
  }
}

function getHtmlAttribute(attributes, name) {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attributes);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : null;
}

/**
 * Fast advisory checks for generated source. This function scans/parses only and never executes it.
 * A clean report is not a substitute for running the project, browser, or its tests.
 */
export function reviewCodeArtifact(path, content) {
  const filePath = String(path || "");
  if (!isCodeArtifactPath(filePath)) {
    return { kind: "heuristic-static", status: "skipped", checks: [], skipped: [], findings: [] };
  }

  const source = String(content ?? "");
  const findings = [];
  const checks = ["unfinished-markers", "debug-logs", "blocking-alerts", "touch-handler-patterns"];
  const skipped = [];
  const add = (code, message) => {
    if (!findings.some((finding) => finding.code === code)) findings.push({ code, severity: "warning", message });
  };
  const checkSyntax = (code, label) => {
    const result = compileWithoutRunning(code);
    if (result.checked || result.error) checks.push(label);
    if (result.skipped) skipped.push(label + ": " + result.skipped);
    if (result.error) add("javascript-syntax", label + " syntax check failed: " + result.error);
  };

  if (UNFINISHED_MARKER_RE.test(source)) {
    add("unfinished-marker", "Check for unfinished TODO/FIXME markers or placeholder content and complete or remove them.");
  }
  if (/\bconsole\s*\.\s*(?:log|debug)\s*\(/i.test(source)) {
    add("debug-log", "Review console.log/debug calls; remove development-only logging unless it is intentionally part of the requested output.");
  }
  if (/\balert\s*\(/i.test(source)) {
    add("blocking-alert", "Review blocking alert() usage and prefer an accessible in-page status or error message unless the user explicitly requested an alert.");
  }
  if (/touchstart[\s\S]{0,400}preventDefault\s*\(|preventDefault\s*\([\s\S]{0,400}touchstart/i.test(source)) {
    add("touch-click-cancellation", "Check touch controls: preventDefault on touchstart can suppress the subsequent click on mobile; prefer pointer/click handlers.");
  }
  if (/\.(?:html?|[cm]?js|jsx|tsx?)$/i.test(filePath)) {
    checks.push("dynamic-code-execution");
    if (DYNAMIC_CODE_EXECUTION_RE.test(source)) {
      add("dynamic-code-evaluation", "Review eval() or new Function(): dynamic code execution can create injection risks; prefer explicit parsing or safe data-driven logic.");
    }
  }

  const isHtml = /\.html?$/i.test(filePath);
  const isFullHtmlDocument = /<!doctype\s+html|<html[\s>]/i.test(source);
  if (isHtml && isFullHtmlDocument && !/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(source)) {
    add("missing-viewport", "Add a responsive viewport meta tag and check narrow-screen layout.");
  }
  if (isHtml) {
    checks.push("image-accessibility", "new-tab-link-rel", "form-button-type");
    const images = [...source.matchAll(/<img\b([^>]*)>/gi)];
    if (images.some(([, attributes]) => getHtmlAttribute(attributes, "alt") === null)) {
      add("missing-image-alt", "Add an alt attribute to each image; use alt=\"\" for decorative images.");
    }
    const links = [...source.matchAll(/<a\b([^>]*)>/gi)];
    const unsafeBlankLink = links.some(([, attributes]) => {
      const target = getHtmlAttribute(attributes, "target");
      const rel = getHtmlAttribute(attributes, "rel") || "";
      return target?.toLowerCase() === "_blank" && !/(?:^|\s)(?:noopener|noreferrer)(?:\s|$)/i.test(rel);
    });
    if (unsafeBlankLink) {
      add("unsafe-blank-target", "Links opening a new tab should include rel=\"noopener\" (optionally noreferrer) to prevent opener access.");
    }
    const forms = [...source.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form\s*>/gi)];
    const implicitSubmitButton = forms.some(([, body]) => [...body.matchAll(/<button\b([^>]*)>/gi)]
      .some(([, attributes]) => getHtmlAttribute(attributes, "type") === null));
    if (implicitSubmitButton) {
      add("form-button-missing-type", "Set an explicit button type inside forms (for example type=\"button\" or type=\"submit\") to avoid accidental submissions.");
    }
    const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
    for (const [, attributes, body] of scripts) {
      if (/\bsrc\s*=/i.test(attributes) || /\btype\s*=\s*["']module["']/i.test(attributes)) {
        skipped.push("inline script: external/module script requires a module-aware check.");
        continue;
      }
      checkSyntax(body, "inline JavaScript");
    }
  } else if (/\.(?:[cm]?js)$/i.test(filePath)) {
    checkSyntax(source, "JavaScript source");
  } else if (/\.json$/i.test(filePath)) {
    checks.push("JSON syntax");
    try {
      JSON.parse(source);
    } catch (error) {
      add("invalid-json", "JSON syntax check failed: " + String(error?.message || error).slice(0, 180));
    }
  } else if (/\.(?:ts|tsx|jsx)$/i.test(filePath)) {
    skipped.push("TypeScript/JSX syntax requires a project-aware compiler or build step.");
  }

  return {
    kind: "heuristic-static",
    status: findings.length ? "review-needed" : "no-findings",
    checks: [...new Set(checks)],
    skipped: [...new Set(skipped)],
    findings,
  };
}
