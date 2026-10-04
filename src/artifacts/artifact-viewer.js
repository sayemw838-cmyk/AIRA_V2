/* AIRA artifacts: durable file cards, sandboxed preview, source view, and repair loop.
 *
 * Security model: generated code runs inside an iframe sandbox with no allow-same-origin.
 * It cannot read AIRA localStorage, IndexedDB, cookies, or the parent DOM. The only
 * communication path is a source-checked postMessage handshake from the exact iframe.
 */

const MARKER_RE = /\n*\[\[aira-files:([^\]]*)\]\]\s*$/;
const PREVIEWABLE_RE = /\.(html?|svg)$/i;
const MAX_ERRORS = 20;
const PREVIEW_BOOT_TIMEOUT = 5000;
const SANDBOX_URL = new URL("./sandbox.html", import.meta.url).href;

export function isPreviewable(path) {
  return PREVIEWABLE_RE.test(String(path || ""));
}

function uniquePaths(paths) {
  return [...new Set((Array.isArray(paths) ? paths : []).map((path) => String(path || "").trim()).filter(Boolean))];
}

/** Hidden marker appended to saved assistant text so file cards survive reloads. */
export function appendFileMarker(text, paths) {
  const clean = uniquePaths(paths);
  if (!clean.length) return String(text || "");
  return String(text || "") + "\n\n[[aira-files:" + clean.map(encodeURIComponent).join(",") + "]]";
}

export function stripFileMarker(text) {
  const raw = String(text || "");
  const match = raw.match(MARKER_RE);
  if (!match) return { text: raw, paths: [] };
  const paths = uniquePaths(match[1].split(",").filter(Boolean).map((path) => {
    try { return decodeURIComponent(path); } catch { return path; }
  }));
  return { text: raw.slice(0, match.index), paths };
}

/** Paths successfully written/edited this turn, deduped in first-seen order. */
export function collectArtifactPaths(toolCalls = [], toolResults = []) {
  const out = [];
  toolResults.forEach((result, index) => {
    const name = result?.name || toolCalls[index]?.name;
    if (!result?.success || (name !== "write_file" && name !== "edit_file")) return;
    const path = result.output?.path || toolCalls[index]?.arguments?.path;
    if (path && !out.includes(path)) out.push(path);
  });
  return out;
}

/** Fallback for models without tool support: pull a full HTML document from a fenced block. */
export function extractHtmlDocument(markdown) {
  const re = /```(?:html|htm)\s*\n([\s\S]*?)```/gi;
  let match;
  while ((match = re.exec(String(markdown || "")))) {
    const code = match[1].trim();
    if (code.length > 200 && /<!doctype html|<html[\s>]/i.test(code)) return code;
  }
  return null;
}

const CAPTURE_SCRIPT = `<script>(function(){
  var send=function(type,msg){try{parent.postMessage({source:"aira-artifact",type:type,message:String(msg).slice(0,600)},"*")}catch(e){}};
  var shim=function(){var d={};return{getItem:function(k){return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}};
  ["localStorage","sessionStorage"].forEach(function(n){var ok=true;try{window[n].getItem("x")}catch(e){ok=false}if(!ok){try{Object.defineProperty(window,n,{configurable:true,value:shim()})}catch(e){}}});
  window.addEventListener("error",function(e){send("error",(e.message||"Error")+(e.lineno?" (line "+e.lineno+")":""))});
  window.addEventListener("unhandledrejection",function(e){var r=e.reason;send("error","Unhandled promise rejection: "+(r&&r.message?r.message:r))});
  ["warn","error"].forEach(function(k){var original=console[k];console[k]=function(){try{send("error",[].slice.call(arguments).map(function(a){try{return typeof a==="string"?a:JSON.stringify(a)}catch(e){return String(a)}}).join(" "))}catch(e){}return original&&original.apply(console,arguments)}});
})();<\/script>`;

function viewportTag(html) {
  return /<meta[^>]+name=["']viewport["']/i.test(html)
    ? ""
    : '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">';
}

/** Inject capture + viewport support without removing or rewriting the artifact's own markup. */
export function buildPreviewDoc(source) {
  const html = String(source || "");
  if (/^\s*<svg[\s>]/i.test(html)) {
    return '<!doctype html><html><head><meta charset="utf-8">' + viewportTag("") + CAPTURE_SCRIPT +
      '<style>html,body{margin:0;min-height:100%;display:grid;place-items:center;background:#fff}svg{max-width:100%;max-height:100vh}</style></head><body>' + html + '</body></html>';
  }
  const head = html.match(/<head[^>]*>/i);
  if (head) {
    const injected = viewportTag(html) + CAPTURE_SCRIPT;
    return html.slice(0, head.index + head[0].length) + injected + html.slice(head.index + head[0].length);
  }
  const root = html.match(/<html[^>]*>/i);
  if (root) {
    return html.slice(0, root.index + root[0].length) + '<head><meta charset="utf-8">' + viewportTag("") + CAPTURE_SCRIPT + '</head>' + html.slice(root.index + root[0].length);
  }
  const doctype = html.match(/^\s*<!doctype[^>]*>/i);
  if (doctype) return html.slice(0, doctype[0].length) + '<meta charset="utf-8">' + viewportTag("") + CAPTURE_SCRIPT + html.slice(doctype[0].length);
  return '<meta charset="utf-8">' + viewportTag("") + CAPTURE_SCRIPT + html;
}

export function buildFixPrompt(path, errors) {
  const list = [...new Set((errors || []).map(String))].slice(0, 8).map((error, index) => `${index + 1}. ${error}`).join("\n");
  return `The file "${path}" shows these errors when opened in the viewer:\n${list}\n\nRead the file, find the cause, and fix it with edit_file (small targeted edits). Then tell me what was wrong in one or two sentences.`;
}

const CSS = `
.art-card{display:flex;align-items:center;gap:10px;margin-top:8px;padding:10px 12px;border:1px solid var(--border3);border-radius:12px;background:var(--bg2);max-width:520px}
.art-card-icon{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent);flex:none;font-size:11px;font-weight:700}
.art-card-name{flex:1;min-width:0;font-size:13px;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.art-card-meta{font-size:10px;color:var(--text6);margin-top:2px}
.art-card-actions{display:flex;gap:6px;flex:none}
.art-btn{height:30px;padding:0 11px;border:1px solid var(--border3);border-radius:8px;background:var(--bg4);color:var(--text3);font:12px inherit;cursor:pointer}
.art-btn:hover{background:var(--bg5);color:var(--text)}
.art-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-text)}
.art-btn.primary:hover{filter:brightness(1.07);color:var(--accent-text)}
.art-btn:disabled{opacity:.55;cursor:wait}
.art-overlay{position:fixed;inset:0;z-index:200;display:none;flex-direction:column;background:var(--bg)}
.art-overlay.open{display:flex}
.art-bar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--border3);background:var(--bg2);flex:none}
.art-title-wrap{flex:1;min-width:0}
.art-title{font-size:13px;font-weight:650;color:var(--text2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.art-subtitle{font-size:10px;color:var(--text6);margin-top:2px}
.art-body{flex:1;min-height:0;position:relative;background:#fff}
.art-body iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff}
.art-source{position:absolute;inset:0;margin:0;padding:18px;overflow:auto;background:var(--bg3);color:var(--text2);font:12px/1.55 ui-monospace,Menlo,Consolas,monospace;white-space:pre;tab-size:2}
.art-loading{position:absolute;inset:0;display:grid;place-items:center;background:var(--bg3);color:var(--text5);font-size:13px;pointer-events:none}
.art-loading[hidden]{display:none}
.art-errors{flex:none;max-height:30%;overflow:auto;border-top:1px solid var(--border3);background:var(--bg2);padding:9px 14px;font:12px/1.45 ui-monospace,Menlo,Consolas,monospace;color:var(--text3)}
.art-errors[hidden]{display:none}
.art-errors-head{display:flex;align-items:center;gap:8px;margin-bottom:5px;font:600 12px system-ui,sans-serif;color:var(--text2)}
.art-errors-count{color:#c0392b}
.art-errors .art-err{color:#c0392b;margin:3px 0;white-space:pre-wrap}
`;

export function createArtifactViewer({ readFile, onFix }) {
  let overlay = null, titleEl, subtitleEl, bodyEl, loadingEl, errorsEl, errListEl, fixBtn, srcBtn, reloadBtn, copyBtn, frame = null, srcEl = null;
  let current = null, source = "", errors = [], showSource = false, previewDoc = "", bootTimer = null;

  function ensureDom() {
    if (overlay) return;
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    overlay = document.createElement("div");
    overlay.className = "art-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      '<div class="art-bar"><div class="art-title-wrap"><div class="art-title"></div><div class="art-subtitle">Sandboxed preview · external network blocked</div></div>' +
      '<button type="button" class="art-btn" data-act="source">Code</button>' +
      '<button type="button" class="art-btn" data-act="reload">Reload</button>' +
      '<button type="button" class="art-btn" data-act="copy">Copy</button>' +
      '<button type="button" class="art-btn" data-act="download">Download</button>' +
      '<button type="button" class="art-btn primary" data-act="close">Close</button></div>' +
      '<div class="art-body"><div class="art-loading">Starting preview…</div></div>' +
      '<div class="art-errors" hidden><div class="art-errors-head"><span class="art-errors-count"></span><span>Preview reported an error</span><button type="button" class="art-btn primary" data-act="fix">Fix with AIRA</button></div><div class="art-errors-list"></div></div>';
    document.body.appendChild(overlay);
    titleEl = overlay.querySelector(".art-title");
    subtitleEl = overlay.querySelector(".art-subtitle");
    bodyEl = overlay.querySelector(".art-body");
    loadingEl = overlay.querySelector(".art-loading");
    errorsEl = overlay.querySelector(".art-errors");
    errListEl = overlay.querySelector(".art-errors-list");
    fixBtn = overlay.querySelector('[data-act="fix"]');
    srcBtn = overlay.querySelector('[data-act="source"]');
    reloadBtn = overlay.querySelector('[data-act="reload"]');
    copyBtn = overlay.querySelector('[data-act="copy"]');
    overlay.addEventListener("click", async (event) => {
      const act = event.target?.dataset?.act;
      if (act === "close") close();
      else if (act === "reload") await reload();
      else if (act === "download") download(current, source);
      else if (act === "copy") await copySource();
      else if (act === "source") { showSource = !showSource; render(); }
      else if (act === "fix") { const path = current, found = errors.slice(); close(); if (onFix) onFix(path, found); }
    });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape" && overlay.classList.contains("open")) close(); });
    window.addEventListener("message", (event) => {
      if (!frame || event.source !== frame.contentWindow) return;
      const data = event.data;
      if (!data || data.source !== "aira-artifact") return;
      if (data.type === "ready") {
        clearTimeout(bootTimer);
        loadingEl.hidden = true;
        frame.contentWindow.postMessage({ source: "aira-parent", html: previewDoc }, "*");
      } else if (data.type === "error") {
        addError(data.message);
      }
    });
  }

  function addError(message) {
    const clean = String(message || "Preview error").trim().slice(0, 600);
    if (!clean || errors.includes(clean) || errors.length >= MAX_ERRORS) return;
    errors.push(clean);
    renderErrors();
  }

  function renderErrors() {
    errorsEl.hidden = errors.length === 0;
    errorsEl.querySelector(".art-errors-count").textContent = `${errors.length} error${errors.length === 1 ? "" : "s"}`;
    errListEl.innerHTML = "";
    errors.forEach((message) => { const item = document.createElement("div"); item.className = "art-err"; item.textContent = message; errListEl.appendChild(item); });
  }

  function teardown() {
    clearTimeout(bootTimer);
    bootTimer = null;
    if (frame) { frame.remove(); frame = null; }
    if (srcEl) { srcEl.remove(); srcEl = null; }
  }

  function render() {
    teardown();
    const canPreview = isPreviewable(current);
    srcBtn.style.display = canPreview ? "" : "none";
    reloadBtn.style.display = canPreview && !showSource ? "" : "none";
    srcBtn.textContent = showSource ? "Preview" : "Code";
    copyBtn.style.display = "";
    loadingEl.hidden = !canPreview || showSource;
    if (canPreview && !showSource) {
      frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts allow-modals allow-forms allow-pointer-lock");
      frame.setAttribute("title", `Sandboxed preview of ${current}`);
      frame.setAttribute("referrerpolicy", "no-referrer");
      previewDoc = buildPreviewDoc(source);
      frame.src = SANDBOX_URL;
      bodyEl.appendChild(frame);
      bootTimer = setTimeout(() => { if (frame && !loadingEl.hidden) { loadingEl.textContent = "Preview did not start. Try Reload or inspect Code."; addError("Preview did not start within 5 seconds."); } }, PREVIEW_BOOT_TIMEOUT);
    } else {
      srcEl = document.createElement("pre");
      srcEl.className = "art-source";
      srcEl.textContent = source;
      bodyEl.appendChild(srcEl);
    }
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      copyBtn.textContent = "Copied";
      setTimeout(() => { if (copyBtn) copyBtn.textContent = "Copy"; }, 1200);
    } catch { copyBtn.textContent = "Copy failed"; }
  }

  async function reload() {
    if (!current) return;
    reloadBtn.disabled = true;
    const result = await readFile(current);
    reloadBtn.disabled = false;
    if (result?.success) source = String(result.output?.content || "");
    errors = [];
    renderErrors();
    render();
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove("open");
    teardown();
  }

  async function open(path) {
    ensureDom();
    const result = await readFile(path);
    if (!result?.success) { alert(result?.error || `Could not open ${path}`); return; }
    current = path;
    source = String(result.output?.content || "");
    errors = [];
    showSource = !isPreviewable(path);
    titleEl.textContent = path;
    subtitleEl.textContent = isPreviewable(path) ? "Sandboxed preview · external network blocked" : "Source view";
    renderErrors();
    overlay.classList.add("open");
    render();
  }

  return { open, close };
}

export function download(path, content) {
  const name = String(path || "file.txt").split("/").pop() || "file.txt";
  const type = isPreviewable(path) ? "text/html" : "text/plain";
  const url = URL.createObjectURL(new Blob([String(content || "")], { type: type + ";charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Build the file-card strip shown under an assistant message. */
export function renderFileCards(paths, { viewer, readFile }) {
  const wrap = document.createElement("div");
  wrap.className = "art-cards";
  uniquePaths(paths).forEach((path) => {
    const card = document.createElement("div");
    card.className = "art-card";
    const extension = (path.split(".").pop() || "file").toUpperCase().slice(0, 4);
    const icon = document.createElement("div");
    icon.className = "art-card-icon";
    icon.textContent = extension;
    const info = document.createElement("div");
    info.className = "art-card-info";
    const name = document.createElement("div");
    name.className = "art-card-name";
    name.textContent = path;
    name.title = path;
    const meta = document.createElement("div");
    meta.className = "art-card-meta";
    meta.textContent = isPreviewable(path) ? "Previewable artifact" : "Workspace file";
    info.append(name, meta);
    const actions = document.createElement("div");
    actions.className = "art-card-actions";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "art-btn primary";
    openBtn.textContent = isPreviewable(path) ? "Open" : "View";
    openBtn.addEventListener("click", () => viewer.open(path));
    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "art-btn";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", async () => {
      const result = await readFile(path);
      if (result?.success) download(path, result.output?.content || "");
      else alert(result?.error || `File no longer exists: ${path}`);
    });
    actions.append(openBtn, downloadBtn);
    card.append(icon, info, actions);
    wrap.appendChild(card);
  });
  return wrap;
}
