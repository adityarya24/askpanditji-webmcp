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
  banner.textContent = state.place
    ? "Place confirmed — all five tools offered"
    : "No place confirmed — the calculators are withheld";
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

function syncToolset() {
  const context = navigator.modelContext;
  if (!context) return;

  const tools = currentTools();
  const signature = tools.map((tool) => tool.name).join(",");
  if (signature === lastSignature) return;
  lastSignature = signature;

  // provideContext replaces the whole toolset, which is what a state change
  // means here: the previous set is no longer true of this page.
  context.provideContext({ tools });
  state.registered = tools.map((tool) => tool.name);
  log("state", `Toolset now offers ${state.registered.length}: ${state.registered.join(", ")}`);
}

function boot() {
  const supported = typeof navigator !== "undefined" && "modelContext" in navigator;
  const notice = el("support");
  if (notice) {
    notice.className = supported ? "banner ok" : "banner missing";
    notice.innerHTML = supported
      ? "WebMCP detected — this page registers its tools with the agent."
      : "WebMCP is not available in this browser, so no tools are registered. " +
        "The demo below still explains what would happen. See the README to enable it.";
  }
  render();
  renderLog();
}

document.addEventListener("DOMContentLoaded", boot);
