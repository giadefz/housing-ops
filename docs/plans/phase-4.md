# Phase 4 — dedup, statuses, recheck

Plan for the implementing agent. Before starting, read `docs/design/offer.md`
(status lifecycle and versions), `docs/design/storage.md` (tables), and
`src/core/services/scan.service.ts` (the pipeline the phases build on).

## Done when

- Re-running `scan` creates no duplicate dwellings or offers.
- A price change on a known listing is detected and emits `offer.updated`.
- A listing absent across two consecutive provider runs flips to `gone`.

## What already exists (do not rebuild)

- **Dedup-lite.** `scan.service` resolves a dwelling by normalized address key
  (`pack.addressKey`) and an offer by `(provider, listingId)`. Re-scanning reuses
  ids; a changed relisting appends a version (`nextVersions`) instead of a new
  offer.
- **Change-only versions.** A version is appended only when the offer changed
  (`hasChanged`).
- **Market outcomes.** `store.markMarketOutcome(offerId, outcome, observedAt)`
  writes a `market_events` row and sets the status.
- **Statuses.** `OFFER_STATUSES` in `core/domain/offer.ts`.

## Slices

### 4a — cross-provider dedup (verify and lock)

Goal: the same dwelling listed on two portals becomes one dwelling, two offers.
Steps: confirm `resolveDwelling` keys on the address, not the provider, so a
second provider's listing of the same place reuses the dwelling id. Add a scan
test with two providers returning the same address.
Done when: the test passes and the `dwellings` table has one row for the two
offers.

### 4b — recheck bookkeeping

Goal: know which known offers a provider run did not return.
Steps: add a store query for a provider's known offer ids; in `scanProvider`,
compare the ids seen this run against the known ids. Track a per-offer miss
count (see Open decisions).
Done when: a re-scan that omits a listing records a miss for it.

### 4c — delisting flips to `gone`

Goal: an offer absent across two consecutive runs becomes `gone`.
Steps: when a known offer's miss count reaches two, call
`markMarketOutcome(offerId, "gone", observedAt)`. A run that returns the listing
resets the count.
Done when: removing a listing from the provider and scanning twice flips it to
`gone`.

### 4d — `offer.updated` emission

Goal: a price or field change on a known listing emits `offer.updated`.
Steps: `nextVersions` already detects the change; emit an `offer.updated` event
when a version is appended. Publishers are Phase 6, so route the event through a
minimal in-process sink for now (see Open decisions).
Done when: a second scan with a changed price produces exactly one
`offer.updated` for that offer.

## Open decisions

- **Miss detection.** A `misses` column on `offers` (a migration) versus deriving
  it from consecutive runs.
- **Event surface in 4d.** A minimal publisher/event sink now, or defer emission
  to Phase 6 (publishers) and only detect in Phase 4.
- **Filtered-out status.** A filtered-out offer currently stays `seen`; decide
  whether it should carry its own status.
