// WebMCP tool definitions.
//
// The point of this demo is one specific failure: an agent filling in a birth
// form has to guess the birth place, and Indian place names collide badly.
// Typing "jai" offers a village called Jai before it offers Jaipur. A guess
// there does not produce an error — it produces a confident, wrong horoscope,
// because the chart is computed from the coordinates of whatever place was
// picked.
//
// So resolve_birth_place never returns a single answer it invented. It returns
// the candidates and says who has to choose.

import { state, log, render } from "./app.js";

const api = async (path, init) => {
  const response = await fetch(`/api/${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || body.detail || `Request failed (${response.status})`);
  }
  return body;
};

const text = (value) => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

// Birth details are shared by all three calculators.
const BIRTH_SCHEMA = {
  dob: { type: "string", description: "Date of birth as DD/MM/YYYY, e.g. 15/08/1995" },
  tob: { type: "string", description: "Time of birth as HH:MM in 24-hour form, e.g. 14:30" },
};

const requireConfirmedPlace = () => {
  if (!state.place) {
    throw new Error(
      "No birth place confirmed yet. Call resolve_birth_place first and have " +
        "the user choose one of the candidates — do not guess.",
    );
  }
  return state.place;
};

export const TOOLS = {
  resolve_birth_place: {
    name: "resolve_birth_place",
    description:
      "Find candidate birth places for a partial name. Returns every match " +
      "with its state and coordinates. When more than one is returned you " +
      "MUST ask the user which one they mean — do not pick for them. A wrong " +
      "place silently produces a wrong chart.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Place name or partial name, e.g. 'jaipur'" },
      },
      required: ["query"],
    },
    async execute({ query }) {
      log("tool", `resolve_birth_place("${query}")`);
      const { results = [] } = await api(`places?q=${encodeURIComponent(query)}`);
      state.candidates = results;
      state.place = null;
      render();

      if (results.length === 0) {
        return text({ candidates: [], note: `No place matches "${query}". Ask the user to rephrase.` });
      }
      if (results.length === 1) {
        state.place = results[0];
        render();
        return text({
          confirmed: results[0],
          note: "Exactly one match, so it is confirmed and the calculators are now available.",
        });
      }
      return text({
        candidates: results,
        note:
          `${results.length} places match "${query}". Ask the user which one is ` +
          "their birth place, then call confirm_birth_place with that exact name. " +
          "Do not choose on their behalf.",
      });
    },
  },

  confirm_birth_place: {
    name: "confirm_birth_place",
    description:
      "Record which candidate the user chose. Call this only after the user " +
      "has actually answered. The calculators stay unavailable until it succeeds.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Exact name of the chosen candidate" },
        state: { type: "string", description: "Its state, when two candidates share a name" },
      },
      required: ["name"],
    },
    async execute({ name, state: region }) {
      log("tool", `confirm_birth_place("${name}"${region ? `, "${region}"` : ""})`);
      const pool = state.candidates.length
        ? state.candidates
        : (await api(`places?q=${encodeURIComponent(name)}`)).results || [];

      const matches = pool.filter(
        (item) =>
          item.name.toLowerCase() === name.toLowerCase() &&
          (!region || (item.state || "").toLowerCase() === region.toLowerCase()),
      );
      if (matches.length === 0) {
        throw new Error(
          `"${name}" is not one of the candidates. Call resolve_birth_place and choose from what it returns.`,
        );
      }
      if (matches.length > 1) {
        throw new Error(
          `"${name}" is still ambiguous across ${matches.length} states. Ask the user which state.`,
        );
      }
      state.place = matches[0];
      state.candidates = [];
      render();
      return text({ confirmed: matches[0], note: "Birth place set. The calculators are now available." });
    },
  },

  calculate_moon_sign: {
    name: "calculate_moon_sign",
    description:
      "Moon sign, nakshatra, pada and a reading across six life areas, for the " +
      "confirmed birth place. Requires a confirmed place.",
    inputSchema: {
      type: "object",
      properties: {
        ...BIRTH_SCHEMA,
        area: {
          type: "string",
          enum: ["career", "marriage", "finance", "health", "education", "spiritual"],
          description: "Optional life area to answer in detail",
        },
      },
      required: ["dob", "tob"],
    },
    async execute({ dob, tob, area }) {
      const place = requireConfirmedPlace();
      log("tool", `calculate_moon_sign(${dob} ${tob} @ ${place.name})`);
      const result = await api("moon-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, tob, place: place.name, ...(area ? { area } : {}) }),
      });
      state.result = { kind: "Moon sign", data: result };
      render();
      return text(result);
    },
  },

  check_mangal_dosh: {
    name: "check_mangal_dosh",
    description:
      "Whether Mangal Dosha is present, where Mars sits, and which classical " +
      "cancellations apply. Requires a confirmed place.",
    inputSchema: { type: "object", properties: BIRTH_SCHEMA, required: ["dob", "tob"] },
    async execute({ dob, tob }) {
      const place = requireConfirmedPlace();
      log("tool", `check_mangal_dosh(${dob} ${tob} @ ${place.name})`);
      const result = await api("mangal-dosh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, tob, place: place.name }),
      });
      state.result = { kind: "Mangal Dosha", data: result };
      render();
      return text(result);
    },
  },

  check_sade_sati: {
    name: "check_sade_sati",
    description:
      "Sade Sati / Dhaiya status with the phase and its window. Requires a confirmed place.",
    inputSchema: { type: "object", properties: BIRTH_SCHEMA, required: ["dob", "tob"] },
    async execute({ dob, tob }) {
      const place = requireConfirmedPlace();
      log("tool", `check_sade_sati(${dob} ${tob} @ ${place.name})`);
      const result = await api("sade-sati", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, tob, place: place.name }),
      });
      state.result = { kind: "Sade Sati", data: result };
      render();
      return text(result);
    },
  },
};

// Which tools are offered depends on page state. Before a place is confirmed
// the calculators are not in the toolset at all — the agent cannot reach for a
// chart it has no coordinates for, so the guess never gets the chance to happen.
export const TOOLSET = {
  unconfirmed: ["resolve_birth_place", "confirm_birth_place"],
  confirmed: [
    "resolve_birth_place",
    "confirm_birth_place",
    "calculate_moon_sign",
    "check_mangal_dosh",
    "check_sade_sati",
  ],
};
