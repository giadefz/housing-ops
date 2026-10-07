# Phase 5 — queue + profile

Plan for the implementing agent. Before starting, read `docs/design/offer.md`
(status lifecycle, analyses, interactions), `docs/design/storage.md` (tables),
and `docs/design/api.md` (the commands). The judgment model was settled on
2026-10-07 (D49–D54).

## Done when

- The judgment loop runs entirely through commands — `queue`, `verdict set`
  (triage), `verdict set` (analyse), `interact` — with every record persisted.
- `profile get` / `profile set` read and write `profile.yml` with validation.
- `profile digest` returns the profile plus deterministic stats with evidence ids.
- Agent-layer memory files are out of scope (Phase 7, D54).

## Judgment model (D49, D50)

Two tiers. Each tier has its own verdict words:

- **triage**: `screened | reject | hold`
- **analyse**: `shortlist | reject | hold`

Verdict to status:

- `screened` → `screened`, `reject` → `rejected`, `hold` → `held`,
  `shortlist` → `shortlisted`.

Statuses:

- `pending` — gate on: cleared filters, waiting for triage.
- `passed` — gate off: cleared filters; terminal for the pipeline, reviewable by
  the agent.
- `screened` — cleared triage, waiting for deep analysis. New; set only by the
  triage `screened` verdict.
- `shortlisted` / `rejected` / `held` — outcomes.

Lifecycle:

- `seen → passed | pending`
- `pending → screened | rejected | held`
- `passed → screened | rejected | held`
- `screened → shortlisted | rejected | held`

Rule: triage first, analysis second. Triage inputs are `pending` and `passed`;
the analysis input is always `screened`.

Re-judging (D50): a verdict is allowed from any non-closed status
(not `let` / `sold` / `gone`); a new verdict supersedes the earlier one, both
kept in history. The tier constrains the verdict words, not the source status.

`pass` stays a filter verdict only; `screened` is the agent's triage verdict.

## What already exists (do not rebuild)

- `listQueue` projection over offers joined to dwellings (`sqlite/queue.ts`) and
  `OfferSummary` (carries the `fetched_at` staleness hint).
- `recordAnalysis` / `recordInteraction` store methods.
- `Analysis` / `Interaction` domain types.
- `recordAgentVerdict` / `recordUserAction` transitions (`core/domain/offer.ts`).
- `getOffer` + `OfferDetail`.

## Slices

### 5a — status model

Change `ANALYSIS_VERDICTS` from `pass | shortlist | reject | hold` to
`screened | shortlist | reject | hold`; add `screened` to `OFFER_STATUSES`.
Extend the transition function to map the four verdicts to statuses and to
allow re-judging from any non-closed state. Validate verdict words per tier.
Update the `offer.md` lifecycle and the `api.md` `--verdict` values.
Done when: unit tests cover every verdict-to-status transition and reject
market-closed offers.

### 5b — `queue`

Expose the projection on `ApplicationPort` + CLI. Add a status count to the
port (`countOffersByStatus`) so the service returns `{ offers, total }`.
Default `--status pending`, default `--limit 20` (D51).
Done when: `queue` lists compact rows with a correct `total`.

### 5c — `verdict set`

Core service: load the offer, apply the tier + verdict transition, `saveOffer`,
and `recordAnalysis` (author `agent`, `createdAt` from the clock). CLI per
`api.md`; returns `{ analysis_id }`.
Done when: triage then analyse leaves the expected status, two analyses, and a
correct history.

### 5d — `interact`

Core service: load the offer, `recordUserAction`, `saveOffer`, and
`recordInteraction`. CLI per `api.md`; returns `{ interaction_id, status }`.
`shared` records an interaction without moving status.
Done when: each action records an interaction and sets the expected status;
closed listings are refused.

### 5e — `profile get` / `profile set`

Pure `readProfileValue(profile, path)` and `setProfileValue(profile, path,
jsonValue)` (dotted path, JSON value, whole-result `ProfileSchema` validation,
loud failure). Add a `writeProfile(root, profile)` capability to
`ApplicationDependencies`; `defaults` implements it with fs + `yaml.dump`,
always `version: 1`. Only `profile.yml` is writable this way. Document in
`config.md` that a machine write reformats the file and drops comments (D52).
Done when: `profile set budget.max 2300` persists and re-reads; bad input fails.

### 5f — `profile digest`

Compact store projections for the stats (D53) plus a digest service that joins
the parsed profile with them and stamps `generatedAt`. Interactions only.
Examples carry ids for citations.
Done when: after `interact favorited` on an offer, the digest reflects it; the
stats are covered by tests.

## Open decisions

- None in the core. The agent-layer memory is deferred (D54).

## Deferred (Phase 7, D54)

- The Muse-inspired cited memory: curated `TASTE.md` + dated logs + citations to
  evidence ids, claim supersession, forgetting, and a session-end / cron
  "dream" that distills logs into the curated sheet.
