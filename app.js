// Page state, rendering, and WebMCP registration.

import { TOOLS, TOOLSET } from "./tools.js";

export const state = {
  candidates: [],
  place: null,
  result: null,
  entries: [],
  registered: [],
};

const el = (id) => document.getElementById(id);

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch],
  );

export function log(kind, message) {
  state.entries.unshift({ kind, message, at: new Date() });
  state.entries = state.entries.slice(0, 40);
  renderLog();
}

// ---------------------------------------------------------------- rendering

function renderLog() {
  const list = el("log");
  if (!list) return;
  list.innerHTML = state.entries.length
    ? state.entries
        .map(
          (entry) => `<li class="entry ${entry.kind}">
            <time>${entry.at.toLocaleTimeString()}</time>
            <span>${escapeHtml(entry.message)}</span>
          </li>`,
        )
        .join("")
    : `<li class="empty">Nothing yet. Ask the agent for a horoscope.</li>`;
}

function renderPlace() {
  const box = el("place");
  if (!box) return;

  if (state.place) {
    box.innerHTML = `<div class="confirmed">
      <span class="tick">✓</span>
      <div>
        <strong>${escapeHtml(state.place.name)}</strong>
        <small>${escapeHtml(state.place.state || "")} · ${state.place.lat.toFixed(4)}, ${state.place.lon.toFixed(4)}</small>
      </div>
    </div>`;
    return;
  }

  if (!state.candidates.length) {
    box.innerHTML = `<p class="empty">No birth place resolved yet.</p>`;
    return;
  }

  box.innerHTML = `<p class="ask">${state.candidates.length} places match. This is the
    question the agent has to <em>ask</em>, not answer:</p>
    <ul class="candidates">${state.candidates
      .map(
        (item) => `<li>
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.state || "")} · ${item.lat.toFixed(4)}, ${item.lon.toFixed(4)}</small>
        </li>`,
      )
      .join("")}</ul>`;
}

function renderResult() {
  const box = el("result");
  if (!box) return;
  box.innerHTML = state.result
    ? `<h3>${escapeHtml(state.result.kind)}</h3>
       <pre>${escapeHtml(JSON.stringify(state.result.data, null, 2))}</pre>`
    : `<p class="empty">No calculation yet.</p>`;
}

function renderTools() {
  const box = el("tools");
  if (!box) return;
  box.innerHTML = state.registered
    .map((name) => {
      const gated = !TOOLSET.unconfirmed.includes(name);
      return `<li${gated ? ' class="gated"' : ""}>
        <code>${escapeHtml(name)}</code>
        ${gated ? "<small>unlocked by a confirmed place</small>" : ""}
      </li>`;
    })
    .join("");
}

function renderBanner() {
  const banner = el("state-banner");
  if (!banner) return;
  // Say which guarantee is actually in force, not the one we would prefer.
  const withheld = webmcpMode() === "replaceable";
  banner.textContent = state.place
    ? "Place confirmed — the calculators will run"
    : withheld
      ? "No place confirmed — the calculators are not offered"
      : "No place confirmed — the calculators will refuse to run";
  banner.className = state.place ? "banner ok" : "banner waiting";
}

/** Redraw the page and keep the offered toolset in step with its state. */
export function render() {
  renderPlace();
  renderResult();
  renderBanner();
  syncToolset();
  renderTools();
}

// ------------------------------------------------------------------ WebMCP

// Which tools exist depends on page state. Before a place is confirmed the
// calculators are not offered at all — withholding the tool is a stronger
// guarantee than asking a model nicely not to guess.
function currentTools() {
  const names = state.place ? TOOLSET.confirmed : TOOLSET.unconfirmed;
  return names.map((name) => TOOLS[name]);
}

let lastSignature = "";

// Chrome does not ship the whole proposal. Chrome 151 exposes registerTool,
// getTools and executeTool on navigator.modelContext, but no provideContext
// and no unregisterTool — so a page cannot always withdraw a tool it has
// already published. Detect what exists rather than assuming the spec.
export function webmcpMode() {
  const context = typeof navigator !== "undefined" ? navigator.modelContext : null;
  if (!context) return "absent";
  if (typeof context.provideContext === "function") return "replaceable";
  if (typeof context.registerTool === "function") return "additive";
  return "unusable";
}

function syncToolset() {
  const context = navigator.modelContext;
  if (!context) return;
  const mode = webmcpMode();

  if (mode === "replaceable") {
    // The clean path: republish the set that is true right now, so a tool the
    // page cannot honour is not merely refused, it is not offered.
    const tools = currentTools();
    const signature = tools.map((tool) => tool.name).join(",");
    if (signature === lastSignature) return;
    lastSignature = signature;
    context.provideContext({ tools });
    state.registered = tools.map((tool) => tool.name);
    log("state", `Toolset republished — ${state.registered.length} offered`);
    return;
  }

  if (mode !== "additive") return;

  // Additive-only: every tool is registered once and stays registered, so the
  // gate has to live inside the tool. requireConfirmedPlace() throws with an
  // instruction rather than returning a chart from coordinates nobody chose —
  // a weaker guarantee than withholding it, but the same outcome for the user.
  if (lastSignature) return;
  lastSignature = "all";
  const all = TOOLSET.confirmed.map((name) => TOOLS[name]);
  for (const tool of all) context.registerTool(tool);
  state.registered = all.map((tool) => tool.name);
  log("state", `Registered ${all.length} tools (additive API — calculators self-gate)`);
}

function boot() {
  const mode = webmcpMode();
  const notice = el("support");
  if (notice) {
    const message = {
      replaceable:
        "WebMCP detected, with provideContext — the toolset is republished on " +
        "every state change, so the calculators are not offered until a place is confirmed.",
      additive:
        "WebMCP detected, registerTool only — this build has no provideContext, " +
        "so all five tools stay registered and the calculators refuse to run " +
        "until a place is confirmed.",
      unusable:
        "navigator.modelContext exists but exposes neither provideContext nor " +
        "registerTool, so no tools could be published.",
      absent:
        "WebMCP is not available in this browser, so no tools are registered. " +
        "The page still explains what would happen — see the README to enable it.",
    }[mode];
    notice.className = mode === "absent" || mode === "unusable" ? "banner missing" : "banner ok";
    notice.textContent = message;
  }
  render();
  renderLog();
}

document.addEventListener("DOMContentLoaded", boot);
