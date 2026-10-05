# Filters

A filter is a pure judgment over one offer: no network, no side effects, no
memory beyond what the context hands it. The pipeline runs them in
`pipeline.yml` order and records every verdict.

## The contract (v0 — provisional)

A filter has an id and a pure `evaluate`. `evaluate` receives the offer, the
dwelling, the profile, and comparables from history, and returns a **decision**:
pass; fail with a reason; or skip with a reason (insufficient data). Parameters
come from the profile (`profile.yml`) — there is no per-filter config, so
preferences live in one place.

A filter may declare a `country`; it is excluded from the pipeline (and shown
`available: false`) when the active country differs. Generic filters leave it
unset.

The runner records a **verdict** per filter (`{ filterId, outcome, reason }`)
and passes the offer when no filter fails. A stage's `missing` policy turns a
skip into a fail when set to `fail`.

Provisional means the shape is the working hypothesis, finalized against real
provider data. Prefer small filters with sharp reasons — the agent reads these
reasons during triage. Comparables are read-only stored offers (for price-outlier
checks), never other filters' internals.

## Pipeline file

```yaml
version: 1
filters:
  - id: location
    enabled: true
    missing: skip            # skip | fail — what a skip becomes here
  - id: budget
    enabled: true
    missing: fail
```


`missing: skip` is the default (fail-open); hard constraints flip to `fail`.
Disabling a filter is a config edit, never a code change.

## Built-ins (v1, provisional pending real data)

location, budget, type, bedrooms, size_m2, floor, building age, BER,
features (must-have / must-not-have), furnishing, lease/tenure,
listing-health (deterministic red flags → marks `suspicious`, never
auto-fails), commute (distance-based). Schools/pets and anything requiring
taste live behind the gate, not here.

## Authoring flow

The harness writes the module into `filters.local/`, runs
`filter check <id>` — schema validation plus a dry-run against stored
offers showing the verdict distribution with examples — and asks you to
approve. Approval records the hash (`config.md`); only then can the filter be
enabled in `pipeline.yml`.
