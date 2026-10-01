const TOOL_NAMES = Object.freeze([
  "calculator",
  "current_time",
  "list_files",
  "read_file",
  "write_file",
  "delete_file",
  "run_js",
]);

function success(output) {
  return { success: true, output };
}

function failure(error, extra = {}) {
  return { success: false, error: String(error || "Tool failed"), ...extra };
}

export function safeCalculate(expression) {
  const expr = String(expression || "").trim();
  if (!expr) return failure("Empty expression");
  if (expr.length > 800) return failure("Expression too long");
  try {
    const sanitized = expr
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/√/g, "Math.sqrt")
      .replace(/\^/g, "**")
      .replace(/\bpi\b/gi, "Math.PI")
      .replace(/\be\b(?![a-z])/gi, "Math.E")
      .replace(/\bsqrt\s*\(/gi, "Math.sqrt(")
      .replace(/\babs\s*\(/gi, "Math.abs(")
      .replace(/\bround\s*\(/gi, "Math.round(")
      .replace(/\bfloor\s*\(/gi, "Math.floor(")
      .replace(/\bceil\s*\(/gi, "Math.ceil(")
      .replace(/\bmin\s*\(/gi, "Math.min(")
      .replace(/\bmax\s*\(/gi, "Math.max(")
      .replace(/\bsin\s*\(/gi, "Math.sin(")
      .replace(/\bcos\s*\(/gi, "Math.cos(")
      .replace(/\btan\s*\(/gi, "Math.tan(")
      .replace(/\blog\s*\(/gi, "Math.log(")
      .replace(/\bln\s*\(/gi, "Math.log(")
      .replace(/\blog10\s*\(/gi, "Math.log10(")
      .replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)");
    if (/[;{}=`]|Function|eval|window|document|globalThis|import|require|process|fetch|XMLHttp/i.test(sanitized)) {
      return failure("Expression contains disallowed constructs");
    }
    const result = new Function("Math", `"use strict"; return (${sanitized});`)(Math);
    if (typeof result !== "number" || !Number.isFinite(result)) return failure("Result is not a finite number");
    const rounded = Math.round(result * 1e12) / 1e12;
    return success(Number.isInteger(rounded) ? Math.round(rounded) : rounded);
  } catch (error) {
    return failure(error.message || "Invalid expression");
  }
}

export function currentTime(args = {}, now = new Date()) {
  const timezone = String(args.timezone || "UTC");
  const unix = Math.floor(now.getTime() / 1000);
  if (timezone === "UTC" || timezone === "local") {
    return success({
      iso: timezone === "UTC" ? now.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC") : now.toString(),
      unix,
      timezone,
    });
  }
  try {
    return success({
      iso: now.toLocaleString("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "long" }),
      unix,
      timezone,
    });
  } catch {
    return success({ iso: now.toString(), unix, timezone: "local" });
  }
}

export function restrictedJavaScript(code) {
  const source = String(code || "").trim();
  if (!source) return failure("Empty code");
  if (source.length > 20000) return failure("Code too long");
  if (/\b(fetch|XMLHttpRequest|WebSocket|Worker|importScripts|eval|Function|document\.|window\.|localStorage|indexedDB|navigator\.|location\.|process|require|import\s*\()/i.test(source)) {
    return failure("Code contains disallowed APIs (network, DOM, storage, dynamic code)");
  }
  try {
    const logs = [];
    const consoleApi = {
      log: (...values) => logs.push(values.map(String).join(" ")),
      warn: (...values) => logs.push("[warn] " + values.map(String).join(" ")),
      error: (...values) => logs.push("[error] " + values.map(String).join(" ")),
      info: (...values) => logs.push(values.map(String).join(" ")),
    };
    const result = new Function("console", "Math", `"use strict";\n${source}`)(consoleApi, Math);
    return success({ result: result === undefined ? null : result, logs: logs.length ? logs : undefined });
  } catch (error) {
    return failure(error.message || "Execution error");
  }
}

function schemas() {
  const stringParam = (description) => ({ type: "string", description });
  return {
    calculator: {
      name: "calculator",
      description: "Evaluate a safe mathematical expression.",
      parameters: { type: "object", properties: { expression: stringParam("Expression") }, required: ["expression"] },
    },
    current_time: {
      name: "current_time",
      description: "Get the current date and time.",
      parameters: { type: "object", properties: { timezone: stringParam("IANA timezone, UTC, or local") }, required: [] },
    },
    list_files: {
      name: "list_files",
      description: "List files in the injected virtual workspace.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    read_file: {
      name: "read_file",
      description: "Read a file from the injected virtual workspace.",
      parameters: { type: "object", properties: { path: stringParam("Workspace-relative path") }, required: ["path"] },
    },
    write_file: {
      name: "write_file",
      description: "Write a text file to the injected virtual workspace.",
      parameters: { type: "object", properties: { path: stringParam("Workspace-relative path"), content: stringParam("Full text content") }, required: ["path", "content"] },
    },
    delete_file: {
      name: "delete_file",
      description: "Delete a file only after explicit approval for the exact target.",
      parameters: { type: "object", properties: { path: stringParam("Workspace-relative path") }, required: ["path"] },
    },
    run_js: {
      name: "run_js",
      description: "Run JavaScript in a restricted, offline sandbox.",
      parameters: { type: "object", properties: { code: stringParam("JavaScript source") }, required: ["code"] },
    },
  };
}

function requiredString(args, key) {
  const value = args && args[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function unavailable() {
  return failure("Virtual workspace is not available");
}

export function createToolRegistry({ workspace = null, now = () => new Date(), approval = null } = {}) {
  const definitions = schemas();
  const execute = async (name, args = {}) => {
    if (!TOOL_NAMES.includes(name)) return failure("Unknown tool: " + name);
    try {
      if (name === "calculator") return safeCalculate(args.expression || args.expr || "");
      if (name === "current_time") return currentTime(args, now());
      if (name === "run_js") return restrictedJavaScript(args.code);
      if (!workspace) return unavailable();
      if (name === "list_files") return typeof workspace.list === "function" ? await workspace.list() : unavailable();
      const path = requiredString(args, "path");
      if (!path) return failure("path is required");
      if (name === "read_file") return typeof workspace.read === "function" ? await workspace.read(path) : unavailable();
      if (name === "write_file") {
        if (typeof args.content !== "string") return failure("content must be a string");
        return typeof workspace.write === "function" ? await workspace.write(path, args.content) : unavailable();
      }
      if (name === "delete_file") {
        const decision = typeof approval === "function" ? await approval({ action: "delete_file", path }) : false;
        if (decision !== true) return failure("Approval required before deleting this file", { approvalRequired: { action: "delete_file", path } });
        return typeof workspace.delete === "function" ? await workspace.delete(path) : unavailable();
      }
      return failure("Tool is not implemented: " + name);
    } catch (error) {
      return failure("Tool execution error: " + (error?.message || String(error)));
    }
  };
  return {
    names: () => [...TOOL_NAMES],
    definitions: () => TOOL_NAMES.map((name) => ({ type: "function", function: definitions[name] })),
    execute,
  };
}

export const TOOL_NAMES_LIST = TOOL_NAMES;
