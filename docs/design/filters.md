# Filters

A filter is a pure judgment over one offer: no network, no side effects, no
memory beyond what the context hands it. The pipeline runs them in
`pipeline.yml` order and records every verdict.

## The contract (v0 — provisional)

A filter has an id, a config schema that validates its own config, and an
`evaluate` step. `evaluate` receives the offer, the dwelling, the profile, and
comparables from history, and returns a **verdict**: pass; fail with a reason;
or skip with a reason (insufficient data).

Provisional means the shape is the working hypothesis, finalized against real
provider data in Phase 3. Prefer small filters with sharp reasons over clever
ones — the agent reads these reasons during triage. History is read-only access
to stored offers (for comparables, e.g. price-outlier checks), never to other
filters' internals.

## Pipeline file

```yaml
version: 1
filters:
  - id: location
    enabled: true
    missing: skip            # skip | fail — what a skip becomes here
    config: { areas: ["Dublin 8", "Dublin 6"], radius_km: null }
  - id: budget
    enabled: true
    missing: fail
    config: { max: 2200, currency: EUR, include_utilities_estimate: true }
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
