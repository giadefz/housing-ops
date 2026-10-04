# Offer, statuses, analyses, interactions

Co-located: the canonical record, its lifecycle, and everything attached to
it. Storage tables mirror this file one-to-one (`storage.md`).

## Canonical Offer (immutable, versioned snapshot)

One row per fetch. Same listing fetched twice → two versions, never an
update in place. `id` is ours (stable across versions); `listing_id` is the
provider-native stable id and the primary dedup key alongside `url`.

```ts
interface Offer {
  id: string                    // ours, stable across versions
  version: number                // increments per fetch of the same listing
  provider: string
  listing_id: string            // provider-native stable id
  url: string
  market: 'rent' | 'buy'
  price: { amount: number; currency: string; period: 'month' | 'once'; extras?: string }
  address: { free_text: string; city?: string; county?: string; eircode?: string; geo?: { lat: number; lng: number } }
  type: { layout: 'apartment' | 'penthouse' | 'studio' | 'duplex' | 'terrace' | 'house' | 'other'; tenure?: 'freehold' | 'leasehold' }
  rooms: { bedrooms: number; bathrooms?: number }
  size_m2?: number
  floor?: number; floors_total?: number
  year_built?: number
  ber?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  features: string[]            // normalized tags: garden, parking, gas-heating, …
  furnished?: 'furnished' | 'unfurnished' | 'part'
  lease_months?: number
  available_from?: string       // date
  agency?: string
  images: string[]
  description_raw: string
  posted_at?: string
  fetched_at: string
  raw: unknown                  // provider payload snapshot, for audit + remapping
}
```

Missing fields stay missing — filters `skip` on absence per their own
`missing` policy (`filters.md`), never on invented defaults.

## Interchange — listing JSON v1

What provider output must validate against *before* normalization. Deliberately
smaller than Offer: the provider's job ends at faithful capture; enrichment
and defaults belong to normalization.

```ts
interface Listing {
  listing_id: string
  url: string
  market: 'rent' | 'buy'
  price: { amount: number; currency: string; period: 'month' | 'once' }
  address_text: string
  bedrooms?: number
  description?: string
  images?: string[]
  posted_at?: string
  extra: Record<string, unknown>   // everything else, preserved into Offer.raw
}
```

Providers emit one JSON object per line (JSONL) on stdout, or a JSON array
in a file the config points at. Anything failing this schema goes to
dead-letter with the validation error attached.

## Status lifecycle

`seen → passed | pending → judged(shortlisted | rejected | held)`.
User states layer on top and never overwrite market states:
`viewed, favorited, viewing_requested, visited, rejected_by_user(reason)`.
Market states: `let, sold, gone`.

Transitions are append-only events; the current status is derived, so the
full history of a listing is always recoverable. A favorited listing flipping
to `gone` is surfaced explicitly in the next review session ("you may have
missed this one").

## Rechecks

Known listings re-fetch on a per-provider interval (default 48h,
`recheck_hours` in `providers.yml`). A recheck that finds changed fields
stores a new version and emits `offer.updated`; a listing absent from two
consecutive rechecks flips to `gone`.

## Analysis record

Written by `verdict set`, one per tier per offer (a later analyse supersedes
the earlier triage, both kept):

```ts
interface Analysis {
  id: string; offer_id: string
  tier: 'triage' | 'analyse'
  verdict: 'pass' | 'shortlist' | 'reject' | 'hold'
  reason: string
  pros: string[]; cons: string[]
  price_assessment?: string      // vs stored comparables
  red_flags?: string[]
  recommendation?: string; confidence?: number
  author: 'agent' | 'user'; created_at: string
}
```

## Interaction record

Written by `interact`: `{ id, offer_id, action, reason?, created_at }`.
`viewed` is recorded when the agent surfaces an offer in a session, so the
digest can distinguish "seen" from "never shown".

## Dwelling

The physical place behind one or more offers. Identity is the normalized
address key (same dwelling relisted years later links to the known row).
Universal facts (address, size + unit, rooms, layout, year built, floors)
plus pack-validated `attributes` (BER, Eircode, …). Preference learning
aggregates over dwellings; the pipeline processes offers.
