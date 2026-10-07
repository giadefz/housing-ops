# Phase 4 — dedup and version history

Plan for the implementing agent. Before starting, read `docs/design/offer.md`
(status lifecycle, staleness and delisting) and `src/core/services/scan.service.ts`
(the pipeline the phases build on).

Scope was cut on 2026-10-07 (D46–D48): the recheck-based delisting and the
`offer.updated` event surface are gone. Delisting is proven, never inferred;
`offer_versions` is the change record.

## Done when

- Re-running `scan` creates no duplicate dwellings or offers.
- The same dwelling listed on two providers becomes one dwelling, two offers.
- A price change on a known listing appends a version (and no new offer).

## What already exists (do not rebuild)

- **Dedup-lite.** `scan.service` resolves a dwelling by normalized address key
  (`pack.addressKey`) and an offer by `(provider, listingId)`. Re-scanning reuses
  ids, so a second provider's listing of the same address reuses the dwelling id.
- **Change-only versions.** `nextVersions`/`hasChanged` append a version only
  when the listing changed.
- **Last-retrieved.** `offers.fetched_at` is set to the fetch time on every scan
  that returns the offer; an absent offer keeps its previous value. This is the
  staleness hint (`OfferSummary.fetchedAt`).

## Slices

### 4a — cross-provider dedup (verify and lock)

Goal: the same dwelling listed on two providers becomes one dwelling, two offers.
Steps: confirm `resolveDwelling` keys on the address, not the provider, so a
second provider's listing of the same place reuses the dwelling id. Add a scan
test with two providers returning the same address (and the same eircode, which
the Irish address key includes).
Done when: the test passes and the `dwellings` table has one row for the two
offers.

### 4b — change history (detect and test)

Goal: a changed field on a known listing appends an `offer_versions` row.
Steps: a scan test already covers the price change (`scan.service.test.ts`
"adds a version when a re-scan finds a change"); confirm it asserts the new row
and that no second offer is created. Emit nothing.
Done when: the test shows one offer with two versions and a second
`offer_versions` row.

## Open decisions

- None. Recheck bookkeeping, delisting, and the event surface were cut (D46–D48).
- Deferred to their own phases: the link-check command that proves `gone`, and
  the queue/digest that reads verdicts to exclude filtered-out offers.

## Real-data notes (local `.lab` run against Daft)

- A Daft wrapper must patch `daftlistings`' headers (`User-Agent`/`Origin`/
  `Referer`), send its stdout chatter to stderr, read coordinates from the raw
  record (the `.latitude` accessor throws when a listing has no `point`), and
  omit absent fields (`"ber": null` fails the pack enum).
- Re-scanning 60 live listings produced no duplicates (offers and versions
  stayed put) — dedup-lite holds on real data.
- **Dwelling identity risk.** 60 offers collapsed to 50 dwellings: several
  PRS-building listings share a title with no unit number, so distinct units
  merge into one dwelling. Decide whether dwelling identity needs more than the
  address text.
