# Storage

SQLite (`data/housing.db`, WAL, single writer) behind a `StoragePort` — the
default adapter, swappable for anything implementing the port. Tables mirror
`offer.md` one-to-one.

## Tables

- `offers` — immutable versioned snapshots: `(offer_id, version)` primary;
  payload columns for the queryable fields (provider, url, listing_id,
  market, price, currency, city, county, eircode, bedrooms, size_m2, type,
  ber, status, fetched_at) plus `raw JSON` for the rest.
- `verdicts` — `(run_id, offer_id, filter_id, pass|fail|skip, reason)`.
- `runs` — `(run_id, started_at, finished_at, stats JSON, health JSON)`.
- `dead_letter` — `(id, run_id, provider, payload JSON, error, received_at)`.
- `analyses` — per `offer.md`, append-only.
- `interactions` — per `offer.md`, append-only.
- `providers_state` — `(provider_id, last_run, last_ok, health,
  consecutive_failures)`.

## YAML vs DB

Explicit preferences live **only** in `config/profile.yml` (human-editable,
agent-editable, zod-validated). The DB never caches them — `prefs digest`
joins YAML prefs with DB stats at call time, so there is exactly one place
where "what I want" is written.

## Migrations

Numbered SQL files in `src/storage/migrations/`, applied in order on open,
recorded in `_migrations`. A migration only ever adds tables/columns —
history is never rewritten. `doctor` verifies the schema version matches the
core and says how to resolve a mismatch.
