# Housing-Ops — Decision Log

Running log of every decision point from the design grilling
(method: `.agents/skills/grilling/SKILL.md`).
Settled decisions are appended under **Decisions** with context / options / choice / why.
Hard-to-reverse or surprising decisions get promoted to ADRs in `docs/adr/`
(format: `.agents/skills/domain-modeling/ADR-FORMAT.md`).

## Vision (from the user, 2026-10-03)

- LLM-based housing helper, rent or buy.
- User clones the repo, attaches one or more providers (property portals); some included by default based on country.
- Every offer flows through a composable pipeline of filters (location, budget, house layout: penthouse/apartment/etc., …) and is extensible.
- The user can build new filters by speaking to the LLM.
- Offers passing the pipeline end up in a small local database.
- Optional "publishers" attach at the end of the pipeline (Telegram bot, push to another DB, …).
- The DB stores all considered houses, including rejected ones — history + signal for the agent about what the user likes.
- Everything must be composable and customisable.
- Reference: https://github.com/career-ops-hq/career-ops (studied 2026-10-03). Same intent; we must beat it on openness to customisation.

## Career-ops findings (inputs to the design)

Keep: two-tier pipeline (zero-token deterministic scan → LLM judgment only where needed); provider module contract with auto-discovery; SSRF/security guardrails on providers; auth-gated sources out of core; "never auto-submit" HITL spirit; dedup via URL + recheck windows.

Invert: host-CLI coupling (the LLM CLI *is* the agent → we want our own thin agent loop as an inbound adapter); prompt-locked evaluation (A–H report format fixed in prompt files → LLM becomes a replaceable capability with structured outputs); files-are-canonical (Markdown/TSV primary, SQLite merely derived, "never primary, not even opt-in" → we go DB-first); flat root with ~70 loose scripts (→ proper modular layout).

Open risks to grill: scraping ToS per country; deduping the same listing across portals; preference learning without runaway LLM cost; user-authored extension code (filters) safety/review.

## Status

- [x] Round 1: stack, agent runtime, scope, country, LLM backends, storage, distribution
- [x] Round 2a: interface discussion (D8–D11)
- [x] Round 2b: pipeline & components (D12–D21)
- [x] Round 3: status lifecycle, two-tier workflow, provider rework (D24), extension trust, ToS stance, scheduling, misc — EXCEPT v1 flow list (re-asked)
- [x] Round 4: provider shape, v1 example configs, v1 flow list (D29–D31)
- [x] Grilling: frontier empty — shared understanding CONFIRMED by user 2026-10-03
- [x] README.md written (vision doc for humans, ahead of design doc + ADRs)
- [x] ADRs 0001–0007 written to `docs/adr/`
- [x] Phase 0 scaffold done: build passes, 8/8 tests green, `doctor` reports missing config gracefully
- [x] GitHub repo: private `giadefz/housing-ops`, initial commit `e1f116a` pushed to `main` (identity: Gianluca + noreply email, repo-local)
- [x] Restructure + Dwelling/Offer split + country packs (D34–D35), committed as `a765987` and pushed to `main`
- [x] Phase 1 slice 1 inc. per-entity tables (D36), committed as `a62e992` and pushed to `main`
- [x] Phase 1 slice 2 + DAO reshape (D37): dwellings/offers/versions/verdicts/analyses/interactions/runs/market-events + queue + port factory (52 tests), committed as `e9a9f11` and pushed to `main`
- [x] Phase 1 slice 3a: `offer get` + inbound port + modular CLI + datastore abstraction + record vocabulary (D38–D39, 56 tests), committed as `e7752f1` and pushed to `main`
- [x] Phase 1 slice 3b: `validate` schema-version finding (60 tests) — **Phase 1 complete**
- [x] Phase 2 slice 2a: process adapter (69 tests), committed as `78b31de` and pushed to `main`
- [x] Phase 2 slice 2b: providers.yml schema + registry + `provider test <id>` (75 tests), committed as `c50f2ce`
- [x] Phase 2 slice 2c: `provider list` + composition/entry split + injected dependencies (D43–D44, 80 tests), committed as `3a5d49d`
- [x] Phase 2 slice 2d: `scan` pipeline (fetch→normalize→store, per-record dead-letter; D45) + change-only versions (83 tests), committed as `b259c46` — **Phase 2 complete**
- [x] Phase 3 — filters: contract + ordered runner, `pipeline.yml`, `filter list`/`check`, country gating, local discovery (approved `filters.local`), built-ins budget/bedrooms/location/type/size (102 tests; type/size uncommitted)
- [x] Phase 4 — dedup + version history (recheck/delisting cut per D46–D48; 107 tests) — **Phase 4 complete**
- [x] Phase 5 — queue + profile (`queue`, `verdict set`, `interact`, `profile get/set/digest`; D49–D54; 131 tests) — **Phase 5 complete**
- [ ] Next: Phase 6 — publishers + gate
- [ ] Round 3+: scheduling, security of user-authored code, testing/CI, license

## Decisions

### Phase 5 scope (2026-10-07, in progress)

Settled while drafting `docs/plans/phase-5.md`.

- **D49 — Judgment model: two tiers, `screened`.** Triage verdicts are `screened | reject | hold`; analyse verdicts are `shortlist | reject | hold`. Statuses: `pending` (gate on: cleared filters, waiting for triage), `passed` (gate off: cleared filters; terminal for the pipeline but reviewable by the agent), `screened` (new: cleared triage, waiting for deep analysis), `shortlisted | rejected | held` (outcomes). Lifecycle: `seen → passed | pending`; `pending → screened | rejected | held`; `passed → screened | rejected | held`; `screened → shortlisted | rejected | held`. Rule: triage first, analysis second, everywhere — triage inputs are `pending` and `passed`, the analysis input is always `screened`. `screened` is a triage word only, so `pass` stays a filter verdict only and the old pass/passed overload disappears. Code/docs: add `screened` to `OFFER_STATUSES`; replace `pass` with `screened` in `ANALYSIS_VERDICTS`; validate verdicts per tier; update the `offer.md` lifecycle and `api.md` `--verdict` values.
- **D50 — Re-judging allowed from any non-closed state.** A new verdict supersedes an earlier one (which stays in history); only `let | sold | gone` are frozen. Matches "a later analysis supersedes the earlier triage; both kept."
- **D51 — `queue` shape.** Default `--status pending`; default `--limit 20`; `data` is `{ offers: OfferSummary[], total }` so the agent sees how many remain. The flow doc says which status each step uses (`pending`/`passed` for triage, `screened` for analysis).
- **D52 — `profile get` / `profile set`.** Pure `readProfileValue(profile, path)` / `setProfileValue(profile, path, jsonValue)` (dotted path, JSON value, whole-result `ProfileSchema` validation, loud failure). Writing is an injected `writeProfile(root, profile)` capability (`defaults` uses fs + `yaml.dump`, always `version: 1`); only `profile.yml` is writable this way. A machine write reformats the file and drops comments (`js-yaml` cannot preserve them) — accepted for v1 and documented in `config.md`.
- **D53 — `profile digest` is deterministic facts, with citations.** Signal is interactions only (D20: user behavior; agent analyses deferred). Stats: `favorited` (count + `OfferSummary` examples carrying ids), `rejected` (count + top reasons from `interact --reason`), `priceBands` (min/median/max over favorited vs. all offers), `topFeatures` (layout/bedrooms/BER frequency among favorited), and a `seen` vs `neverShown` count (from `viewed` interactions, per `offer.md`). Assembled by compact store projections (like `queue.ts`) and a core digest service stamping `generatedAt` from the clock. No embeddings — the DB stays the search surface. Examples include ids so the agent's memory claims can cite evidence.
- **D54 — Agent-layer cited memory (Muse-inspired); deferred to Phase 7.** The agent keeps Markdown memory in the workspace: a curated `TASTE.md` plus dated session logs, where each claim cites evidence (offer/interaction/analysis ids from the DB). A newer claim supersedes an older one, both kept (mirrors D50); forgetting stages a retraction. A session-end or cron "dream" distills logs into the curated sheet (D27: no daemon). The core never reads these files, and `profile.yml` stays the single source of "what I want" — a claim that firms up becomes a `profile set` edit, not a memory-only fact. No embeddings in v1.

### Phase 4 scope (2026-10-07)

- **D46 — Delisting is proven, never inferred.** A scan is a snapshot, not a source of truth about absence: search results can be loose, capped, or paginated, so a listing missing from a run is not evidence it is gone. Counting consecutive misses (`consecutive_misses` column + `listKnownOfferIds`) is dropped. An offer becomes `gone` only when delisting is proven — its url no longer resolves (a future link check) or the user claims it. `markMarketOutcome` stays for that proven path. Amends the recheck-to-`gone` rule of D22 and the Rechecks section of `offer.md`.
- **D47 — No event surface in Phase 4; `offer_versions` is the change record.** A known listing that reappears with changed fields appends an `offer_versions` row (existing `nextVersions`/`hasChanged`); Phase 4 only detects this and tests the new row — it emits no event and adds no table. Notifications, if ever needed, hang off `offer_versions` (e.g. Phase 6 publishers). Amends the `offer.updated` promise of D22/`offer.md`.
- **D48 — `seen` means in-market, not yet queued; filtered-out lives in verdicts.** A filtered-out offer keeps status `seen` so a later scan re-filters it against changed preferences; the failure is expressed by its per-run verdict. No `filtered_out` status is added. Amends the lifecycle wording of D22/`offer.md`.

### Restructure (2026-10-04)

- **D34 — Restructure (skill layout, functional paradigm):** `src/core/{domain,ports,services}` + `src/adapters/{primary,secondary}`; bundled adapters under `src/adapters/secondary/*` + `src/countries/*`, user modules in top-level `*.local/` dirs (auto-discovered; single tsc root requires it). Services are function modules taking data (functional DI — classes only where earned); core imports nothing but zod (fs/yaml/crypto/path live in adapters); the envelope is built in the CLI adapter (wire contract unchanged); `doctor` fully removed → `validate` / `validateWorkspace()` / `ValidationReport` / `findings`; approval replaces pin everywhere (`approvals:` key, `verifyApproval`, `currentHashes`); `src/main.ts` deferred to Phase 1 (first real wiring). Amends D28 (layout) and D25 (pins → approvals).
- **D35 — Dwelling/Offer split + country packs:** `Dwelling` (physical place, address-key identity, universal facts + pack-validated attributes) vs `Offer` (market sighting, provider identity, price/status/versions/verdicts). New extension axis `countries/` (pure packs: attribute schema, key rules, layout mapping, defaults); Ireland first. BER-style filters generalize to a key/operator/value `attribute` filter. Amends D16 (FilterPort.evaluate gains dwelling) and D17 (schema splits into Dwelling + Offer; rooms optional, fail-open).
- **D36 — Per-entity table ownership:** table DDL lives with each domain object (`tables/<entity>.ts` in the SQLite adapter: table name, dependencies, CREATE TABLE text), never as a blob in the runner; `migrate.ts` only orders (dependency sort) and applies. Row mapping joins the same modules in slice 2.
- **D37 — DAO per entity (amends D36):** each SQLite DAO module owns its table's DDL + row DTO/mapping + queries together (`dwelling.ts`, `offer.ts`, `offer-version.ts`, `analysis.ts`, `interaction.ts`, `verdict.ts`, `run.ts`, `dead-letter.ts`, `market-event.ts`, `providers-state.ts`); the `tables/` split is gone. DTO types (`*Record`) translate at the driver edge; the port still speaks entities. `store.ts` is lifecycle only (`openStore`/`closeStore`) plus `createSqliteStore(database)` binding the DAOs to `OfferStorePort`. Cross-entity reads live in projection modules (`queue.ts`). No DAO base class — plain functions.
- **D38 — Datastore contract in core:** `OfferStorePort` lives in `core/ports/store.port.ts` (already datastore-agnostic), joined by `StoreFactory`/`StoreHandle` (open a workspace store + lifecycle) so composition never names a driver. SQLite implements both (`sqliteStoreFactory`); `secondary/store-factory.ts` selects the default, to move into the composition root in 3b. Fixes the leak where the workspace handle exposed the `better-sqlite3` type. `StoreNotInitializedError` is a core error.
- **D39 — Inbound port + per-concept commands:** `ApplicationPort` (`core/ports/application.port.ts`) is the use-case surface every primary/inbound adapter depends on; it owns the shared result types (`VersionInfo`, `Finding`, `ValidationReport`, `OfferDetail`). `createApplication(root)` in `src/main.ts` (composition root) binds the store factory + workspace reader + services to it. The CLI adapter is split by concept (`cli/commands/{system,offer,...}.ts`) behind a shared `CommandHandler`; `cli/run.ts` only parses, dispatches, prints, and sets the exit code. Fixes `commands.ts` heading toward a god object. Mapper/DTO vocabulary normalized to record (`*Record`, `toDomain`/`toRecord`, `recordId`).
- **D43 — Composition separate from the entry point:** `createApplication(root)` lives in `src/composition.ts` (inbound-agnostic wiring). Each inbound adapter owns its entry: the CLI's is `src/adapters/primary/cli/main.ts` (bin), which builds the application and calls `runCli`. Fixes the composition root naming a specific inbound adapter; a future REST/UI adapter adds its own entry over the same `createApplication`.
- **D44 — Dependencies are injected, not imported:** `createApplication(root, dependencies)` takes the concrete I/O adapters (`ApplicationDependencies` = `{ storeFactory, readWorkspace }`) instead of importing SQLite / the filesystem workspace reader itself; pure factories (`buildProviders`, `listProviderSummaries`) and core services are imported directly. `src/defaults.ts` (`createDefaultApplication`) picks the bundled concretes. Plain parameter injection, no DI framework. Swapping a driven adapter is a change at the edge, not inside composition — the seam that later lets config select adapters (D2/D12).
- **D45 — Providers stream raw records; the core validates:** `ProviderPort.fetch` yields `AsyncIterable<unknown>`; the process adapter parses JSON but does not validate. The core validates each record against the interchange (`ListingSchema`) during normalization, so an interchange-invalid record is dead-lettered per record and the run continues (previously the adapter threw and aborted the provider). `provider test` validates too. Pipeline steps return values (a `stored`/`deadLettered` outcome, folded immutably) — no void side-effect helpers.
- **D40 — Provider/adapter vocabulary:** a **provider** is the data source (a `providers.yml` entry). It is realized by an **adapter** whose kind is the mechanism: **process** (runs an external program; `createProcessAdapter`, `process-adapter.ts`, `type: process`) or **module** (TypeScript). The port stays `ProviderPort`. Replaces the earlier "command adapter/provider" naming.
- **D41 — Providers are user-side; ship no maintained providers:** the repo ships the machinery (ProviderPort, process adapter, registry, `provider test`, providers.yml schema, docs), never provider implementations. A provider — its command/wrapper and config — lives in the user's workspace (`providers.local/`, `config/providers.yml`) and is theirs to write and maintain; scrapers break often (daftlistings needs header patching + stdout redirection). Supersedes the "ship thin example configs" part of D30. Consequence: the process adapter expects the command to emit the interchange on stdout; we do not build a declarative mapping engine — translation is the user's wrapper. The `add-provider` agent flow (D31) is how a user creates one.
- **D42 — Product skills live in versioned `skills/`:** agent skills shipped with housing-ops sit in a tracked `skills/<name>/SKILL.md` (first: `write-provider`, model-invoked). Kept current with the code; no symlinks or harness shims for now — consumers copy what they want. The personal dev skills under `.agents/` stay gitignored and separate.

### House rules (2026-10-03)

- **D32 — House rules:** `clean-code` + `typescript-clean-code-cookbook` bind every code change (full texts in the author's personal harness under `.agents/skills/`; repo-committed summary in `docs/HOUSE-RULES.md`). Prettier enforces style (`useTabs: true, tabWidth: 4`); `format:check`, build, and tests stay green. Correction logged: the TS skill is `typescript-clean-code-cookbook`, not `typescript-steering`.
- **D33 — Naming + paradigm:** "doctor" removed entirely, command included — replaced by `validate` / `validateWorkspace()` / `ValidationReport` / `findings: Finding[]` (validate = check conformance against requirements; `ensure`/`repair` rejected because the command reports and never fixes; `checkHealth` rejected as abstract-object). Classes are NOT mandatory: what matters is hexagonal structure (ports, adapters, dependency direction, composition root); our functional style (functions + deps objects as functional DI) stands, classes only where earned.

### Round 4 (2026-10-03)

- **D29 — Provider shape confirmed:** ProviderPort `{ id, country, markets, schema, fetch(cfg, ctx) → Listing[] }`; interchange = documented listing JSON v1 envelope. **Process adapter is the primary extension path** (declared in `providers.yml`: `command, args, env, output: jsonl|json|file, timeout`; core may inject hard profile constraints as args where the tool supports them). Module adapter (TS/JS) for npm libs / plain HTTP. Mapping to canonical Offer stays flexible (declarative field map or tiny mapping module) until real data is seen.
- **D30 — v1 example provider configs:** **daft via `daftlistings`** (MIT, active, gateway API; process adapter over a `python -c` JSONL wrapper) as the primary worked example + `daft-scraper` as documented fallback (SSR path, independent failure mode, stale + 403 risk); **myhome via minimal in-house module adapter** (search-page `__NEXT_DATA__` parsing) with the Apify actor documented as paid hosted alternative; **rent.ie via minimal in-house module adapter** (RSS + SSR detail pages). Each ≤ ~100 lines, explicitly thin/replaceable, any entry swappable via `providers.yml`; ToS-flagged + paced (D26).
- **D31 — v1 agent flow list confirmed:** `setup` · `review` · `triage + analyse` · `author-filter` · `add-provider` · `tune-profile` · `doctor` · optional `draft-message` (drafted only, never sent).

### Round 3 (2026-10-03)

- **D22 — Offer status lifecycle confirmed:** `seen → passed | pending(gate on) → judged(shortlisted | rejected | held)`; user states `viewed, favorited, viewing_requested, visited, rejected_by_user(reason)`; market states `let, sold, gone`. Re-check known listings every 48h default (per-provider configurable); favorited-then-`gone` = strong signal the agent surfaces.
- **D23 — Two-tier agent workflow confirmed:** triage (cheap `pass|reject|hold` + reason) → deep analyse for survivors; structured analysis record per offer (`tier, verdict, reason, pros[], cons[], price_assessment, red_flags[], recommendation, confidence, ts` + free text); LLM-gate ON by default.
- **D24 — Provider model REWORK (user feedback, pending confirmation):** providers must be **very generic** — adapters that wrap *external* libraries/tools, not necessarily our own in-house HTTP scrapers (user example: TheJokersThief/daft-scraper, a Python lib). Core ships a first-class **process adapter** (run an external process, read a documented JSON interchange format) alongside a module adapter (TS/JS wrapping npm libs / doing HTTP). Hand-rolled portal scrapers are optional, NOT the default. My "filter pushdown" idea is subsumed: the core passes hard constraints as provider args where the external tool supports them.
- **D25 — Extension trust confirmed:** `.local/` modules must pass their check/test command + explicit user approval, recorded in `config/extensions.yml` as `{id, sha256, approved_at}`; a changed pinned file is refused until re-approval.
- **D26 — Scraping ToS stance confirmed:** personal-use; default gentle pacing (≥3s between requests, low page ceilings, configurable); no bot-protection circumvention (degraded health + local adapter instead); user-responsibility clause in README/LICENSE. User addendum: the bundled provider set is CONDITIONAL — we may ship zero bundled providers if problems arise; the machinery (contract + adapters + check/test) is the deliverable; user will actually use it.
- **D27 — Scheduling v1:** docs recipes only (cron/launchd → `housing-ops scan`); no built-in scheduler/daemon.
- **D28 — Misc confirmed:** MIT; repo name `housing-ops`; config = `profile.yml` + `pipeline.yml` + `providers.yml` + `extensions.yml`, zod-versioned, `doctor`; layout `src/core`, `src/api`, `src/cli`, `providers/` `filters/` `publishers/` `storage/` (+ `.local/` variants), `agent-flows/`, `config/`, `data/` (gitignored), `docs/`, `tests/`.
- **Still open:** Q6 from round 3 (v1 agent flow list) was skipped — re-asked in round 4.

### Irish scraper ecosystem (fact, 2026-10-03, sub-agent)

- **daft.ie**: `AnthonyBloomer/daftlistings` (Python lib, MIT, active 2026-05, richest fields: m², geo, BER, publishDate; hits `POST https://gateway.daft.ie/api/v2/ads/listings`, 50/page; ⚠ open issue #179 gateway anti-bot non-JSON). `TheJokersThief/daft-scraper` (Python lib+CLI, MIT, last commit 2025-06, SSR `__NEXT_DATA__` path = independent failure mode; ⚠ open 403 issue; CLI emits tables not JSON).
- **myhome.ie**: `logiover~myhome-ie-scraper` Apify actor (MIT docs, actively running, richest output: eircode, GPS, m², BER, agency contacts; driven via `apify call`; **hosted, pay-per-result, needs Apify token**). Plain JSON feed `https://www.myhome.ie/feed/residential/ireland/new-homes/property-for-sale` verified live (new-homes segment ONLY). General sale/rent lives in SSR `__NEXT_DATA__` — small in-house parsing feasible (pattern exists: DanielHowley01/Daft-MyHome-Scraper, MIT, 2026-05).
- **rent.ie**: **no viable OSS tool** (dead 2018 script; no Apify actor). But round-2 research confirmed plain-HTTP access: RSS search + SSR detail pages with BER, lease length, geo, agent, freshness → small in-house adapter feasible.
- Excluded: daft-bot (GPL-3.0), blagoySimandov/daft-scraper (no license), 2018-era relics.

### Round 2b — pipeline & components (2026-10-03)

- **D12 — Synthesis confirmed.** Three-part repo (hexagonal core / dual-use agent layer / data) with four extension axes: `providers/`, `filters/`, `publishers/`, storage adapters; bundled in-repo + `.local/` dirs for user/agent-authored modules, auto-discovered, local wins on id collision.
- **D13 — Harness scope v1:** one canonical `AGENTS.md` + thin skill shims for opencode & Claude Code; other harnesses read AGENTS.md natively.
- **D14 — Headless runs stay zero-token; LLM-gate parks offers as `pending-judgment`.** Usage pattern (user): **keep deterministic filters loose, let the agent read the actual offers** — the to-evaluate queue is expected to be sizeable; that is by design.
- **D15 — Pipeline semantics confirmed:** `fetch → normalize (zod; dead-letter) → filter (ordered; pass|fail|skip; missing: skip|fail) → dedup (relisting → offer.updated) → store (EVERY offer + verdicts) → gate (optional) → terminal`. Storing rejected offers by default; fail-open default on missing data; hard filters flippable to fail-closed.

```mermaid
flowchart LR
  subgraph core["Core — deterministic, zero-token (bash / cron)"]
    P["Providers<br/>daft · myhome · rent.ie · *.local"] --> N["Normalize<br/>→ canonical Offer (zod)"]
    N --> F["Filter pipeline<br/>(ordered, configurable)<br/>LOOSE by design"]
    F --> D["Dedup vs. history<br/>relisting → offer.updated"]
    D --> S[("Store: ALL offers<br/>+ per-filter verdicts")]
    F -.->|hard constraints,<br/>when supported| SP["provider search params<br/>(pushdown)"]
    SP -.-> P
  end

  subgraph agent["Agent layer — in a harness session"]
    S -->|gate ON, passed| Q["to-evaluate queue"]
    Q --> T["Triage (cheap)<br/>pass / reject / hold + reason"]
    T -->|kept| A["Deep analyse<br/>vs profile · price sanity vs history<br/>· red flags · recommendation"]
    T -->|rejected| X["verdict: rejected"]
    A --> J["verdict: shortlist / reject / hold"]
    YOU["You react<br/>viewed · favorited · rejected(+reason)<br/>· viewing-requested"] --> REC
    J --> REC[("analysis + interaction records")]
  end

  REC --> DB[("history DB")]
  DB --> DG["profile digest<br/>explicit profile + learned signal"]
  DG -->|agent context| NEXT["next triage · filter tweaks<br/>· profile edits"]
  S -.->|optional| HOOK["webhook publisher"]
```

- **D16 — Filter contract (v0, provisional):** `id / schema / evaluate({offer, profile, history}) → pass|fail|skip`. Kept deliberately flexible — finalised at implementation once real provider data is known. Built-in filter list also provisional: to be validated against what the scrapers/APIs actually return (Q5 note from user).
- **D17 — Canonical Offer schema confirmed** (incl. `available_from`, `agency`, raw JSON snapshot, eircode); versioned immutable snapshots; verdicts/interactions in separate tables.
- **D18 — Provider contract confirmed:** HTTP-only in core; SSRF guards; auth/cookie-gated → `providers.local/` (untrusted, explicit enable). IE default bundle: **Daft + MyHome + Rent.ie**.
- **D19 — Publishers v1 narrowed:** Telegram OUT of v1. Terminal = the to-evaluate queue the user checks via the agent. Only v1 built-in publisher: a **simple webhook** (optional, low priority).
- **D20 — Preferences confirmed:** explicit `config/profile.yml` (zod) + implicit `interactions` table + `profile digest` command; no embeddings in v1; `viewed` recorded when the agent surfaces an offer.
- **D21 — Onboarding confirmed:** conversational, in the harness (`housing-ops setup` or "set me up"); writes profile/pipeline/providers.yml + initialises DB; zod-validated on read; `doctor` re-validates anytime.

### Round 2 — interface discussion (2026-10-03)

- **D8 — Command surface: importable TS API + thin CLI wrapper.** The core's public face is a versioned, typed use-case surface (JSON in/out), not argv sugar. v1: harnesses drive it through bash commands; no daemon. (User: agreed.)
- **D9 — The product IS the deterministic, expandable "backend".** Interfaces are swappable adapters over that surface: v1 = bash commands for an AI harness; future = REST API or other mechanisms. No UI in v1; guarantee single-owner DB access (SQLite WAL, one writer) so a future `serve` daemon stays cheap. (User: "we are basically building the backend".)
- **D10 — Dual-use agent layer.** Each agent flow (onboarding, add-provider, author-filter, analyse-offer, what-do-I-like) is written ONCE as a declarative flow definition (prompt template + tools + I/O schemas + guardrails) and rendered two ways: AGENTS.md/skill for external harnesses; system-prompt/tool-wiring for a future in-process agent. No per-harness prompt forks (unlike career-ops' `modes/`). (User: agreed.)
- **D11 — LLM placement rule (corrects D5/D7):** the LLM is NEVER in the core, ever. An interface adapter (future own frontend) may own its own LLM client (user's key, OpenAI-compatible/Anthropic endpoint). In v1 there is zero LLM in our process.

### Round 1 (2026-10-03)

- **D1 — Stack: TypeScript on Node ≥ 20, ESM.** User: "node for sure." Rationale recorded: drop-in ESM extension modules, LLM-generated code reliability, LLM-SDK ecosystem, clone→npm i→run.
- **D2 — Storage: SQLite (better-sqlite3) as default source of truth, behind a `StoragePort`; pluggable storage adapters are a first-class extension axis** (user may swap in more durable or cloud storage, e.g. DynamoDB). Deliberate inversion of career-ops' files-are-canonical doctrine → ADR candidate.
- **D3 — Scope: rent AND buy in one app**, one `market: rent|buy` mode per config; mode-aware provider sets and filter families.
- **D4 — Country: Ireland primary/default** (EUR, Eircode, IE provider bundle). Architecture stays multi-country.
- **D5 — Agent model: AI-CLI-first (harness-driven)** — the LLM agent is the user's own AI CLI; the LLM is NOT in-process in v1. Synthesis proposed: the repo ships (a) a real typed hexagonal Node core (offer domain, pipeline engine, ports: Provider/Filter/Publisher/Storage + adapters, deterministic, LLM-free), (b) an agent/instruction layer (AGENTS.md + skill shims) that any harness drives it with, (c) data (SQLite + config). Confirmed via the interface discussion (D8–D11).
- **D6 — Distribution v1: `git clone` + `npm install` + `housing-ops setup`**; no npm packaging in v1. (User deferred to me.)
- **D7 — LLM backend question withdrawn**: with D5, the harness owns the LLM; replaced by "harness scope" + "headless/scheduled runs" questions in Round 2.

### Ireland portal research (fact, 2026-10-03, sub-agent)

Default bundle recommendation: **Daft.ie + MyHome.ie** (buy+rent, national, server-rendered, stable listing ids, sitemaps) and **Rent.ie** (rent, RSS + SSR detail pages: BER rating, lease length, geo coords, agent, freshness; cross-posts to Daft with the same numeric ad id → dedupe by numeric id; rent.ie and Daft share the Distilled/Daft Media database). None of the three need JS rendering/auth/cookies from plain HTTP. All three have ToS clauses against scraping — flag for licensing review. Excluded: DoneDeal (car-first, no stable property URLs).
