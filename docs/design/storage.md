# Storage

SQLite (`data/housing.db`, WAL, single writer) behind a `StoragePort` — the
default adapter, swappable for anything implementing the port. Tables mirror
`offer.md` one-to-one.

## Tables

Each table is owned by its DAO module (`<entity>.ts`), which holds the DDL,
the row DTO/mapping, and the queries together. `migrate.ts` collects the
`TableDefinition`s and applies them in dependency order.

- `dwellings` — `(id, address_key UNIQUE, address, size, rooms, layout,
  year_built, floor, floors_total, attributes)`.
- `offers` — `(id, dwelling_id → dwellings, provider, listing_id, url,
  market, price, images, description, posted_at, fetched_at, status)`,
  `UNIQUE(provider, listing_id)`.
- `offer_versions` — `(offer_id, version)` primary; `fetched_at`, `price`,
  `payload` (raw snapshot).
- `verdicts` — `(run_id, offer_id, filter_id, outcome, reason)`.
- `runs` — `(run_id, provider, started_at, finished_at, stats)`.
- `dead_letter` — `(id, run_id, provider, payload, error, received_at)`.
- `analyses` — per `offer.md`, append-only.
- `interactions` — per `offer.md`, append-only.
- `market_events` — `(id, offer_id, outcome, observed_at, run_id)`.
- `providers_state` — `(provider_id, last_run, last_ok, health,
  consecutive_failures)`.

JSON lives in TEXT columns (nested internals are validated at creation, not
re-validated on read). The `queue` projection joins offers to dwellings for
compact rows.

The datastore contract lives in core (`core/ports/store.port.ts`):
`OfferStorePort` (operations) plus `StoreFactory` / `StoreHandle` (opening a
workspace store and closing it). The SQLite adapter implements both
(`createSqliteStore`, `sqliteStoreFactory`); composition depends only on the
port, so a new datastore is a new adapter — no core change.

## YAML vs DB

Explicit preferences live **only** in `config/profile.yml` (human-editable,
agent-editable, zod-validated). The DB never caches them — `profile digest`
joins the YAML profile with DB stats at call time, so there is exactly one place
where "what I want" is written.

## Migrations

Numbered migrations embedded in the store adapter (`migrations` list).
Each domain object owns its table text (`<entity>.ts` with its dependencies);
`migrate` only orders and applies them. Applied in order on open, recorded
in `_migrations`. A migration only ever adds tables/columns — history is
never rewritten. `validate` reads the schema version (without writing) and
says how to resolve a mismatch. JSON lives in TEXT columns.
