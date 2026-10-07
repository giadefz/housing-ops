# Config

Five YAML files in `config/`, each with `version: 1` and a zod schema per
version. Every read validates; `validate` re-validates everything and reports
each failure with the file, the path, and the fix.

- **`profile.yml`** — who you are to the search: `market`, `budget {max,
  currency, …}`, `areas`, `type {layouts, bedrooms, size_m2, …}`,
  `deal_breakers`, `notes` (free text the agent reads), `gate: on|off`,
  `recheck_hours`. Written by onboarding, edited by conversation afterwards
  (`profile set` for single values, direct YAML edits for the rest — both
  validated).
- **`pipeline.yml`** — ordered filters with `enabled`, `missing: skip|fail`,
  and per-filter `config` (see `filters.md`).
- **`providers.yml`** — provider entries (module or command, `enabled`,
  markets, pacing overrides, `constraints` for pushdown, `recheck_hours`).
- **`publishers.yml`** — publisher entries: a `type: process` command, the
  `events` it subscribes to, and the command/args/env that delivers the payload
  (see `publishers.md`).
- **`extensions.yml`** — approvals for user-authored code:
  `{ id, kind: filter|provider|publisher|storage, path, sha256,
  approved_at }` under `approvals:`. A file whose hash changed is refused
  at load with the exact re-approval command. Nothing in `.local/` runs
  unapproved.
