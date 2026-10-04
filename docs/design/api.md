# Command surface — use cases plus the CLI adapter

Versioned use-case surface. `core/services` exports one function per command
(taking data, returning domain results); `adapters/primary/cli` maps argv to
those functions and prints the envelope. Future interfaces (REST, UI) call
the same functions and build the same envelope.

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
| `offer get <id>` | id | `{ offer, verdicts, analyses, interactions }` |
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

`OfferSummary` is the queue row: `id, provider, price, address_short,
bedrooms, size_m2, type, status, fetched_at`. Full payloads come only from
`offer get` — triage sessions stay cheap by default.
