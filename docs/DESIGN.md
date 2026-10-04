# housing-ops — design

Build contract. Vision lives in `README.md`, every decision in
`docs/DECISIONS.md` — this file says what gets built, in what order, and
where each contract lives. Read this file first, then only the component docs
your task touches.

Maintenance rule: code is the source of truth. When code and these docs
disagree, code wins and the doc gets updated in the same change.

## Vocabulary

Single source of truth for these words — every doc, prompt, and module uses
them with exactly these meanings:

- **provider** — an adapter that fetches listings from one source. Never
  "scraper": a provider may wrap an external tool, a feed, or plain HTTP.
- **interchange** — listing JSON v1, the documented envelope any provider
  output must validate against before normalization.
- **filter** — a pure judgment over one offer: no network, no side effects.
- **verdict** — a filter's output: `pass`, `fail` + reason, or `skip` +
  reason (insufficient data).
- **gate** — the optional stage where passed offers wait for agent judgment
  instead of flowing straight to the terminal.
- **to-evaluate** — the queue of offers awaiting that judgment.
- **triage** — the cheap verdict tier (`pass | reject | hold` + one line).
- **analyse** — the deep verdict tier (pros/cons, price sanity, red flags,
  recommendation + confidence).
- **digest** — the output of `prefs digest`: explicit prefs plus learned
  signal, the agent's working picture of your taste.
- **approval** — a recorded user approval to run an extension, with its file
  hash in `extensions.yml`. A changed file voids its approval until re-approved.
- **dwelling** — the physical place. Identity is the normalized address key;
  universal facts plus country-pack attributes.
- **offer** — a market sighting of a dwelling. Identity is provider plus
  listing id; price, status, versions, verdicts.
- **attributes** — country-specific dwelling facts (BER, Eircode, …),
  validated against the active country pack schema.
- **pack** — a country pack: pure attribute schema, key rules, layout
  mapping, and defaults. No I/O.
- **validate** — check conformance of the workspace (config, approvals,
  database, versions) and report findings. Never fixes.
- **scan** — one full sweep: fetch, normalize, filter, dedupe, store, gate,
  publish. Noun and verb.
- **dead-letter** — listings that failed normalization: stored, inspectable,
  never silently dropped.
- **pushdown** — passing hard profile constraints as provider arguments where
  the underlying tool supports them. An optimization only; the local pipeline
  stays authoritative.

## The three parts

1. **Core** (`src/`): dwelling and offer domains, pipeline engine, five
   ports (`Provider`, `Filter`, `Store`, `Publisher`, `Clock`) with default
   adapters. Deterministic, LLM-free, headless-runnable.
2. **Agent layer** (`AGENTS.md`, skill shims, `agent-flows/`): flow
   definitions the harness drives the core with. No LLM in our process.
3. **Data** (`config/*.yml`, `data/housing.db`): your profile, your history.
   Gitignored, yours, single-writer (SQLite WAL, one owner at a time).

## The loop

fetch → normalize → filter → dedup → store → gate → terminal.
Loose deterministic filters, a sizeable to-evaluate queue, agent triage +
analysis, your reactions, digest back into the agent's context.
Full diagram: `docs/DECISIONS.md` under D15.

## Command-surface rules

The full per-command contract is `docs/design/api.md`. The rules every caller
relies on:

- The surface is **versioned**. `housing-ops version` reports
  `{ core, api }`; `validate` checks compatibility on every session start and
  says exactly what to do when versions drift.
- Every command prints one JSON envelope to stdout:
  `{ ok: true, version, data }` or `{ ok: false, version, error: { code,
  message, hint } }`. Human logs go to stderr. Exit 0 on `ok`, non-zero
  otherwise — including empty results, which are `ok` with empty `data`.
- All writes go through the api surface. The DB file is touched only by the
  storage adapter and numbered migrations — nothing hand-edits it.

## Component map

Reach each doc on exactly these branches:

- **Providers** (`docs/design/providers.md`): wiring an external tool
  (python/node/anything) as a provider; writing a module adapter; debugging
  a fetch; pacing and health.
- **Filters** (`docs/design/filters.md`): authoring a filter; tuning the
  pipeline; reading a dry-run.
- **Offer + statuses** (`docs/design/offer.md`): the canonical schema;
  status transitions; rechecks and delisting; analyses and interactions.
- **Storage** (`docs/design/storage.md`): tables; migrations; what lives in
  YAML vs the DB.
- **Config** (`docs/design/config.md`): editing the profile; provider and
  pipeline files; approving an extension.
- **API** (`docs/design/api.md`): any command's exact JSON in/out.
- **Publishers** (`docs/design/publishers.md`): adding a publisher; event
  semantics; the webhook.
- **Flows** (`docs/design/flows.md`): running onboarding, a review session,
  triage, authoring, tuning — with completion criteria.

## Build order

Phases run in order; each phase's criterion is the gate to the next.

- **Phase 0 — scaffold.** Layout per README; strict TS + zod; use cases as
  functions in `core/services` returning domain results; the CLI adapter in
  `adapters/primary/cli` builds the envelope; `validate` + `version` working.
  Done when: the build passes, `validate` reports missing config without
  crashing, and adding a command means one service function plus one argv line.
- **Phase 1 — storage + offer.** Schema and migrations per `storage.md`;
  immutable versioned snapshots; dead-letter table; `offer get` working.
  Done when: all documented tables exist, migrations apply cleanly on an
  empty DB, and storing the same listing twice yields versioned snapshots
  with no duplication.
- **Phase 2 — providers.** Command + module adapters; interchange
  validation; `provider list/test`; timeouts and pacing; the daft example
  wired.
  Done when: `scan --provider daft` returns real listings as canonical
  Offers, malformed tool output lands in dead-letter with a clear error, and
  `provider test` exercises the sample path.
- **Phase 3 — filters.** Contract, ordered runner with the missing-data
  policy, `pipeline.yml`, `filter list/check` with dry-run distribution,
  built-ins.
  Done when: a full `scan` runs fetch→store with per-filter verdicts
  recorded, and every built-in passes unit tests against fixture offers.
- **Phase 4 — dedup + statuses + recheck.** Cross-provider and history
  dedup; relist emits `offer.updated`; status transitions; 48h recheck;
  delisting flips to `gone`.
  Done when: re-running `scan` creates no duplicates, a delisted listing
  flips to `gone`, and a price change emits `offer.updated`.
- **Phase 5 — queue + prefs.** `queue`, `verdict set`, `interact`, `prefs`
  commands.
  Done when: triage → analyse → react runs entirely through commands with
  every record persisted and the digest reflecting the new signal.
- **Phase 6 — publishers + gate.** Webhook publisher; gate on/off mechanics;
  `publish now`.
  Done when: a passed offer triggers the webhook with the documented
  payload, and gate-off runs skip the pending state entirely.
- **Phase 7 — agent layer.** `AGENTS.md` + shims; flow definitions;
  onboarding end to end (`setup` plus the interview writes valid config;
  `doctor` green).
  Done when: a fresh harness session can set up, scan, triage, and tune
  using only the flow docs.
- **Phase 8 — breadth.** MyHome + Rent.ie adapters; scheduling recipes;
  pacing/health hardening.
  Done when: all three IE providers scan cleanly and the cron recipe is
  verified.
