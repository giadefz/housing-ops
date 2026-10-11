# Command surface — the inbound port and the CLI adapter

`ApplicationPort` (`core/ports/application.port.ts`) is the versioned use-case
surface every inbound adapter drives; it owns the shared result types
(`VersionInfo`, `Finding`, `ValidationReport`, `OfferDetail`).
`createApplication(root, dependencies)` (`src/composition.ts`) wires the given
adapters — the store factory (a port) plus the workspace reader and services —
into it; `createDefaultApplication(root)` (`src/defaults.ts`) supplies the
bundled adapters. Each inbound adapter has its own entry point. The CLI
adapter is split by concept (`cli/commands/<concept>.ts`) behind a shared
`CommandHandler`; `cli/run.ts` parses argv, dispatches, prints the envelope,
and sets the exit code. Future interfaces (REST, UI) depend on the same port
and build their own envelope.

`housing-ops version` → `{ core: "0.1.0", api: 1 }`. Breaking the envelope
or any command's `data` shape bumps `api`; `validate` refuses to run flows
against a mismatched api version and tells the user to update.

| Command | Input | `data` on success |
|---|---|---|
| `setup [--country ie --market rent]` | flags | `{ config: {profile, pipeline, providers}, db }` — paths written |
| `validate` | — | `{ findings: [{ name, ok, detail? }] }` — config, schemas, approvals, database, api compat |
| `version` | — | `{ core, api }` |
| `scan [--provider id]` | flags | `{ fetched, stored, deadLettered }` |
| `queue [--status status] [--limit n]` | flags | `{ offers: [OfferSummary], total }` — compact rows; default status `pending`, default limit 20 |
| `offer get <id>` | id | `{ offer, verdicts }` — the offer carries versions, analyses, interactions |
| `verdict set <id> --tier triage\|analyse --verdict screened\|shortlist\|reject\|hold --reason ... [--pros ...] [--cons ...] [--price-assessment ...] [--red-flags ...] [--recommendation ...] [--confidence 0-1]` | id + fields | `{ analysis_id }` |
| `interact <id> --action viewed\|favorited\|rejected\|viewing-requested\|visited\|shared [--reason ...]` | id + fields | `{ interaction_id, user_status }` — resulting user state |
| `profile digest` | — | `{ profile, stats: { favorited: { count, offers }, rejected: { count, reasons }, priceBands: { favorited, overall }, topFeatures: { layouts, bedrooms, ber }, seen: { viewed, total } }, generatedAt }` |
| `profile get [path]` | optional path | `{ path, value }` |
| `profile set <path> <json-value>` | path + value | `{ path, value }` — validated write, fails loudly on bad input |
| `filter list` | — | `{ filters: [{ id, enabled, missing, available }] }` |
| `filter check <id>` | id | `{ evaluated, pass, fail, skip, examples: [{ offerId, outcome, reason }] }` |
| `provider list` | — | `{ providers: [{ id, type, country, markets, enabled }] }` |
| `provider test <id>` | id | `{ fetched, sample: [Listing] }` — capped sample, validates interchange |
| `publish now [--event offer.passed]` | flags | `{ published: [{ publisher, event, offer_id, ok }] }` |

`OfferSummary` is the queue entry: `id, provider, price, address_short,
bedrooms, size_m2, type, market_status, user_status, fetched_at`. Full payloads
come only from `offer get` — triage sessions stay cheap by default.
