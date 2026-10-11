# Phase 7 — agent layer

Plan for the implementing agent. Before starting, read `docs/design/flows.md`,
`docs/design/config.md`, and `docs/DESIGN.md` (§ The three parts,
§ Build order). Decisions settled 2026-10-11 (D61–D63).

## Done when

- A fresh workspace can be set up in one deterministic call: `setup` writes all
  five config files and initialises the DB.
- `validate` is all-green on that workspace and `queue` returns an empty `ok`.
- The agent-facing docs describe onboarding end to end, with no design or usage
  doc presenting the retired `doctor` command (D33).

## Model (D61, D62)

**The interview lives in the harness; `setup` is the deterministic writer.**
The harness asks the questions, authors the five config documents, and calls
`setup` once. The core derives nothing.

- `setup` reads one JSON object keyed by filename — the five config documents —
  from `--answers <file>`, or stdin. `SetupInputSchema` requires all five keys;
  each document is then validated against its own `ConfigSchema`.
- `setup` writes the documents under `config/`, initialises the database, and
  returns `{ files, database }`. It refuses to clobber an existing `profile.yml`
  unless `--force`.
- No answers schema, no default pipeline, no core-invented values: the config
  schemas we already defined are the format the command accepts. The agent
  writes `providers.yml` empty (D41) and the `add-provider` flow fills it.

## What already exists (do not rebuild)

- `CONFIG_FILES` + `ConfigSchemas` (`core/schemas/index.ts`) — the five
  predetermined formats.
- `readWorkspace` / `writeProfile` / `databasePath` (`secondary/workspace.ts`);
  `migrate` + `SCHEMA_VERSION` (`storage/sqlite/migrate.ts`).
- `validateWorkspace` — the green we must reach.
- `flows.md` and `AGENTS.md` — written, but still say `doctor`.

## Slices

### 7a — setup request + validator

`SetupInputSchema` (`core/schemas/index.ts`, derived from `CONFIG_FILES`: an
object keyed by filename, all five required) and a pure
`planWorkspace(input): WorkspacePlan` in `core/services/setup.service.ts` that
validates each document against its `ConfigSchema` and returns the five
documents. YAML serialisation stays in the adapter.
Done when: a valid request yields five schema-valid documents; a missing or
malformed document throws.

### 7b — workspace writer + DB init

`writeWorkspace(root, plan)` (YAML-dump each file under `config/`) and
`initDatabase(root)` (create `data/housing.db`, run `migrate`) in the secondary
workspace adapter.
Done when: after writing, `readWorkspace` returns those texts and
`validateWorkspace` is all-green; the DB reports `SCHEMA_VERSION`.

### 7c — setup service + composition + CLI

`ApplicationPort.setup(input)`; `ApplicationDependencies` gains `writeWorkspace`
and `initDatabase`; composition guards against an existing profile unless
forced. CLI `setup.ts` reads `--answers`/stdin JSON, validates it with
`SetupInputSchema`, calls `app.setup`, prints `{ files, database }`. `help.ts`
marks it implemented; failure codes per `failures.ts`.
Done when: `housing-ops setup --answers config.json` on a fresh root prints the
envelope and leaves a green workspace.

### 7d — agent-layer docs

Flesh out `AGENTS.md` (session start → `validate`; the review/triage loop;
where flows live). Reconcile `docs/design/flows.md`: `doctor` → `validate`
everywhere, the `setup` answers contract, the empty-`providers.yml` scaffold.
Fix the Phase 7 wording in `DESIGN.md`. Add the `setup` row to `api.md` and the
onboarding note to `config.md`.
Done when: no design or usage doc presents `doctor` as a live command (the
decision log keeps the rename history), and the setup flow matches the command.

### 7e — integration test

A temp-workspace test (fresh dir): `setup` → `validate` all-green → `queue`
empty `ok`. The Phase 7 Done-when, in CI.
Done when: the test passes and fails if `setup` skips a file or the DB.

## Open decisions

- None.
