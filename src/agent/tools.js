const TOOL_NAMES = Object.freeze(["get_time", "calculator", "web_fetch"]);
const MAX_FETCH_CHARS = 12000;
const FETCH_TIMEOUT_MS = 8000;

function success(output) {
  return { success: true, output };
}

function failure(error, extra = {}) {
  return { success: false, error: String(error || "Tool failed"), ...extra };
}

function tokenize(expression) {
  const tokens = [];
  let i = 0;
  while (i < expression.length) {
    const rest = expression.slice(i);
    const whitespace = rest.match(/^\s+/);
    if (whitespace) { i += whitespace[0].length; continue; }
    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i);
    if (number) { tokens.push({ type: "number", value: Number(number[0]) }); i += number[0].length; continue; }
    const name = rest.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
    if (name) { tokens.push({ type: "name", value: name[0].toLowerCase() }); i += name[0].length; continue; }
    const operator = rest.match(/^(\*\*|[()+\-*/^,%])/);
    if (operator) { tokens.push({ type: "operator", value: operator[1] }); i += operator[1].length; continue; }
    throw new Error("Unexpected character near: " + rest.slice(0, 12));
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

function parseMath(expression) {
  const tokens = tokenize(expression.replace(/×/g, "*").replace(/÷/g, "/"));
  let position = 0;
  const peek = () => tokens[position];
  const take = (value = null) => {
    const token = tokens[position];
    if (value !== null && token.value !== value) throw new Error("Expected '" + value + "'");
    position += 1;
    return token;
  };
  const constants = { pi: Math.PI, e: Math.E };
  const functions = {
    sqrt: (x) => Math.sqrt(x), abs: (x) => Math.abs(x), round: (x) => Math.round(x),
    floor: (x) => Math.floor(x), ceil: (x) => Math.ceil(x), sin: (x) => Math.sin(x),
    cos: (x) => Math.cos(x), tan: (x) => Math.tan(x), log: (x) => Math.log(x),
    ln: (x) => Math.log(x), log10: (x) => Math.log10(x), min: (...x) => Math.min(...x),
    max: (...x) => Math.max(...x),
  };
  const primary = () => {
    const token = peek();
    if (token.value === "+" || token.value === "-") { take(); const value = primary(); return token.value === "-" ? -value : value; }
    if (token.type === "number") { take(); return token.value; }
    if (token.type === "name") {
      take();
      if (Object.prototype.hasOwnProperty.call(constants, token.value) && peek().value !== "(") return constants[token.value];
      if (!Object.prototype.hasOwnProperty.call(functions, token.value) || peek().value !== "(") throw new Error("Unknown name: " + token.value);
      take("(");
      const args = [];
      if (peek().value !== ")") { do { args.push(additive()); if (peek().value !== ",") break; take(","); } while (true); }
      take(")");
      if ((token.value === "min" || token.value === "max") ? args.length === 0 : args.length !== 1) throw new Error("Invalid arguments for " + token.value);
      return functions[token.value](...args);
    }
    if (token.value === "(") { take("("); const value = additive(); take(")"); return value; }
    throw new Error("Expected a number, function, or parenthesis");
  };
  const power = () => { let left = primary(); if (peek().value === "^") { take("^"); left = left ** power(); } return left; };
  const postfix = () => { let value = power(); while (peek().value === "%") { take("%"); value /= 100; } return value; };
  const multiplicative = () => { let left = postfix(); while (["*", "/"].includes(peek().value)) { const op = take().value; const right = postfix(); left = op === "*" ? left * right : left / right; } return left; };
  const additive = () => { let left = multiplicative(); while (["+", "-"].includes(peek().value)) { const op = take().value; const right = multiplicative(); left = op === "+" ? left + right : left - right; } return left; };
  const result = additive();
  if (peek().type !== "eof") throw new Error("Unexpected token: " + peek().value);
  return result;
}

export function safeCalculate(expression) {
  const expr = String(expression || "").trim();
  if (!expr) return failure("Empty expression");
  if (expr.length > 800) return failure("Expression too long");
  try {
    const result = parseMath(expr);
    if (typeof result !== "number" || !Number.isFinite(result)) return failure("Result is not a finite number");
    const rounded = Math.round(result * 1e12) / 1e12;
    return success(Number.isInteger(rounded) ? Math.round(rounded) : rounded);
  } catch (error) {
    return failure(error.message || "Invalid expression");
  }
}

export function getTime(args = {}, now = new Date()) {
  const requested = String(args.timezone || "UTC");
  const unix = Math.floor(now.getTime() / 1000);
  if (requested === "UTC") return success({ iso: now.toISOString(), unix, timezone: "UTC", formatted: now.toLocaleString("en-US", { timeZone: "UTC", dateStyle: "full", timeStyle: "long" }) });
  if (requested === "local") return success({ iso: now.toString(), unix, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local", formatted: now.toLocaleString() });
  try { return success({ iso: now.toISOString(), unix, timezone: requested, formatted: now.toLocaleString("en-US", { timeZone: requested, dateStyle: "full", timeStyle: "long" }) }); }
  catch { return failure("Unknown IANA timezone: " + requested); }
}

function stripHtml(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ").trim();
}

export async function webFetch(args = {}, { fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const rawUrl = String(args.url || "").trim();
  if (!rawUrl) return failure("url is required");
  let url;
  try { url = new URL(rawUrl); } catch { return failure("Invalid URL"); }
  if (!["http:", "https:"].includes(url.protocol)) return failure("Only HTTP and HTTPS URLs are supported");
  if (typeof fetchImpl !== "function") return failure("Browser fetch is unavailable");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url.href, { method: "GET", headers: { Accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.1" }, signal: controller.signal });
    const body = await response.text();
    if (!response.ok) return failure("HTTP " + response.status + " " + response.statusText, { status: response.status, url: url.href });
    const text = stripHtml(body).slice(0, MAX_FETCH_CHARS);
    return success({ url: url.href, fetched_at: now().toISOString(), content_type: response.headers?.get?.("content-type") || "", truncated: stripHtml(body).length > MAX_FETCH_CHARS, text });
  } catch (error) {
    if (error?.name === "AbortError") return failure("Request timed out after " + FETCH_TIMEOUT_MS / 1000 + " seconds");
    return failure("Browser fetch failed. The site may block cross-origin requests with CORS; use a Netlify Function proxy for this URL.");
  } finally { clearTimeout(timer); }
}

function schemas() {
  return {
    get_time: { name: "get_time", description: "Get the current date and time. Use an IANA timezone such as Asia/Dhaka, America/New_York, UTC, or local.", parameters: { type: "object", properties: { timezone: { type: "string", description: "IANA timezone, UTC, or local. Defaults to UTC." } }, required: [] } },
    calculator: { name: "calculator", description: "Evaluate a safe mathematical expression using numbers, arithmetic operators, parentheses, percentages, and approved math functions.", parameters: { type: "object", properties: { expression: { type: "string", description: "For example: (438 * 1.17) + 5 or sqrt(81)" } }, required: ["expression"] } },
    web_fetch: { name: "web_fetch", description: "Fetch and extract readable text from a public HTTP or HTTPS URL. Browser CORS may prevent some sites.", parameters: { type: "object", properties: { url: { type: "string", description: "Public HTTP or HTTPS URL to fetch." } }, required: ["url"] } },
  };
}

export function createToolRegistry({ fetchImpl = globalThis.fetch, now = () => new Date() } = {}) {
  const definitions = schemas();
  const execute = async (name, args = {}) => {
    if (!TOOL_NAMES.includes(name)) return failure("Unknown tool: " + name);
    try {
      if (name === "get_time") return getTime(args, now());
      if (name === "calculator") return safeCalculate(args.expression || "");
      return webFetch(args, { fetchImpl, now });
    } catch (error) { return failure("Tool execution error: " + (error?.message || String(error))); }
  };
  return { names: () => [...TOOL_NAMES], definitions: () => TOOL_NAMES.map((name) => ({ type: "function", function: definitions[name] })), execute };
}

export const TOOL_NAMES_LIST = TOOL_NAMES;
