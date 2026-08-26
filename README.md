# Ask before you guess

A [WebMCP](https://github.com/webmachinelearning/webmcp) demo for the OpenAI
WebMCP Challenge.

**Live:** https://askpanditji-webmcp.vercel.app

## The problem

A horoscope is computed from coordinates. If an agent gets the birth place
wrong, nothing errors — you get a confident, wrong answer, which is worse than
a failure because nobody notices.

Indian place names collide badly. Search `jai` and a village called **Jai**
outranks **Jaipur**. Search `jaipur` and **Bijaipur, Madhya Pradesh** is right
behind it. An agent filling in a birth form picks one and moves on.

This is a real defect, found in the autocomplete of a live astrology product,
not a scenario invented for a hackathon.

## What this page does about it

Three ideas, all of them things a DOM-scraping agent cannot do:

**1. The tool returns candidates, not a decision.**
`resolve_birth_place` returns every match with its state and coordinates. When
more than one comes back, the tool result itself says the user has to choose.
The tool never picks.

**2. The dangerous tools are gated on a human having answered.**
`calculate_moon_sign`, `check_mangal_dosh` and `check_sade_sati` do nothing
until a place is confirmed.

How that gate is enforced depends on what the browser actually implements, and
the two are not equivalent:

- **`provideContext` available** — the page republishes the toolset on every
  state change, so before confirmation the calculators are *not offered at all*.
  An agent cannot call a tool it was never handed.
- **`registerTool` only** — Chrome 151 exposes `registerTool`, `getTools` and
  `executeTool` but **no `provideContext` and no `unregisterTool`**, so a page
  cannot withdraw a tool it has published. All five stay registered and the
  calculators refuse at call time with an instruction to resolve the place
  first. Same outcome for the user, weaker guarantee.

The page detects which surface exists and says so in the banner at the top,
rather than claiming the stronger guarantee in both cases.

**3. Confirmation is validated, not trusted.**
`confirm_birth_place` rejects any name that was not among the candidates, and
refuses a name that is still ambiguous across two states.

## Tools

| Tool | Available | Does |
|---|---|---|
| `resolve_birth_place` | always | Candidate places with state + coordinates |
| `confirm_birth_place` | always | Records the human's choice, validated |
| `calculate_moon_sign` | after confirmation | Moon sign, nakshatra, pada, six life areas |
| `check_mangal_dosh` | after confirmation | Mangal Dosha with classical cancellations |
| `check_sade_sati` | after confirmation | Sade Sati / Dhaiya phase and window |

The calculations are real, served by the Swiss-Ephemeris backend behind
[askpanditji.co.in](https://askpanditji.co.in). Nothing here is mocked.

## Trying it

WebMCP is experimental and off by default.

1. Chrome — enable `chrome://flags/#enable-webmcp-testing` and relaunch. (The
   flag has moved between Chrome versions; if it is missing, check
   [the Chrome docs](https://developer.chrome.com/docs/ai/webmcp) for the
   current name and channel.)
2. Open the live URL over HTTPS. WebMCP is a secure-context API, so `file://`
   will not work.
3. The banner at the top says whether WebMCP was detected.
4. Ask your agent: *“What is my moon sign? I was born 15 August 1995 at 14:30
   in jaipur.”*

Watch the **Agent activity** panel. The interesting moment is the agent coming
back to ask which Jaipur you mean, instead of guessing.

Without WebMCP the page still loads and explains itself; it just exposes no
tools.

## Running locally

No build step — it is static files plus one serverless function.

```bash
npx vercel dev
```

Then open the printed `https://` URL. The `api/[...path].js` function proxies
to the astrology API, because that API sets no CORS headers and a direct
cross-origin call from the page is blocked by the browser. The proxy has a path
allowlist so it cannot be pointed at arbitrary upstream routes.

## Layout

```
index.html            the page
app.js                state, rendering, provideContext() wiring
tools.js              the five WebMCP tool definitions
api/[...path].js      allowlisted proxy to the astrology API
```

## Licence

MIT. Built by the author of
[mindsync-ai](https://github.com/adityarya24/mindsync-ai), local-first MCP
orchestration for coding agents.

Astrology is interpretive guidance, not a guarantee of events or outcomes.
