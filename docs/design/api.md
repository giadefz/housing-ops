# Command surface — the inbound port and the CLI adapter

`ApplicationPort` (`core/ports/application.port.ts`) is the versioned use-case
surface every inbound adapter drives; it owns the shared result types
(`VersionInfo`, `Finding`, `ValidationReport`, `OfferDetail`).
`createApplication(root)` (`src/main.ts`) binds the store factory, workspace
reader, and services to it — the only place adapters are wired. The CLI
adapter is split by concept (`cli/commands/<concept>.ts`) behind a shared
`CommandHandler`; `cli/run.ts` parses argv, dispatches, prints the envelope,
and sets the exit code. Future interfaces (REST, UI) depend on the same port
and build the same envelope.

`housing-ops version` → `{ core: "0.1.0", api: 1 }`. Breaking the envelope
or any command's `data` shape bumps `api`; `validate` refuses to run flows
against a mismatched api version and tells the user to update.

| Command | Input | `data` on success |
|---|---|---|
| `setup [--country ie --market rent]` | flags | `{ config: {profile, pipeline, providers}, db }` — paths written |
| `validate` | — | `{ findings: [{ name, ok, detail? }] }` — config, schemas, approvals, database, api compat |
| `version` | — | `{ core, api }` |
| `scan [--provider id] [--dry-run]` | flags | `{ run_id, fetched, normalized, passed, failed, skipped, stored, dead_letter }` |
| `queue [--status pending] [--limit n]` | flags | `{ offers: [OfferSummary] }` — compact rows, not full offers |
| `offer get <id>` | id | `{ offer, verdicts }` — the offer carries versions, analyses, interactions |
| `verdict set <id> --tier triage\|analyse --verdict pass\|shortlist\|reject\|hold --reason ... [--pros ...] [--cons ...] [--price-assessment ...] [--red-flags ...] [--recommendation ...] [--confidence 0-1]` | id + fields | `{ analysis_id }` |
| `interact <id> --action viewed\|favorited\|rejected\|viewing-requested\|visited\|shared [--reason ...]` | id + fields | `{ interaction_id, status }` — resulting user state |
| `prefs digest` | — | `{ profile, stats: { favorited, rejected, price_bands, top_features }, generated_at }` |
| `prefs get [path]` | optional path | profile subtree |
| `prefs set <path> <json-value>` | path + value | `{ path, value }` — validated write, fails loudly on bad input |
| `filter list` | — | `{ filters: [{ id, source: bundled\|local, enabled, configured }] }` |
| `filter check <id>` | id | `{ schema_ok, dry_run: { evaluated, pass, fail, skipped, examples: [...] } }` |
| `provider list` | — | `{ providers: [{ id, type, country, markets, enabled, health }] }` |
| `provider test <id>` | id | `{ fetched, sample: [Listing] }` — capped sample, validates interchange |
| `publish now [--event offer.passed]` | flags | `{ published: [{ publisher, event, offer_id, ok }] }` |

`OfferSummary` is the queue entry: `id, provider, price, address_short,
bedrooms, size_m2, type, status, fetched_at`. Full payloads come only from
`offer get` — triage sessions stay cheap by default.
