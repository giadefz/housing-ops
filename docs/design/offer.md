# Offer, statuses, analyses, interactions

Co-located: the canonical records, their lifecycle, and everything attached to
them. Storage tables mirror this file (`storage.md`).

## Dwelling and Offer

Two related records. A **dwelling** is the physical place; an **offer** is one
market sighting of it. The same dwelling on two portals is two offers and one
dwelling; the same dwelling relisted later is a new offer on the known
dwelling.

- **Dwelling** — identity is the normalized address key. Universal facts:
  address (free text, locality, region, optional coordinates), size with its
  unit, rooms, layout, year built, floors. Country-specific facts (BER,
  Eircode, …) live in pack-validated `attributes`.
- **Offer** — identity is the provider plus its native listing id. Carries the
  url, the market (rent or buy), the price, images, description, posting and
  fetch times, the status, and the versions, analyses, and interactions below.
  `id` is ours and stable; `listing_id` is the provider's stable id and, with
  `url`, the dedup key.

Missing fields stay missing — filters `skip` on absence per their own `missing`
policy (`filters.md`), never on invented defaults.

## Interchange — listing JSON v1

What provider output must validate against *before* normalization. Deliberately
smaller than the domain records: the provider's job ends at faithful capture;
enrichment and defaults belong to normalization. Required: a provider-native
listing id, a url, a market, a price (amount, currency, period), and an address
text. Optional: bedrooms, description, images, posted time, and a free-form
`extra` bag preserved untouched into the offer's raw snapshot.

Providers emit one JSON object per line (JSONL) on stdout, or a JSON array.
Anything failing the schema goes to dead-letter with the validation error
attached.

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

Written by `verdict set`, one per tier per offer (a later analyse supersedes the
earlier triage; both kept). Records the tier (triage or analyse), the verdict
(pass, shortlist, reject, or hold), a reason, pros and cons, an optional price
assessment against stored comparables, optional red flags, an optional
recommendation and confidence, the author (agent or user), and the timestamp.

## Interaction record

Written by `interact`: an id, the offer, the action (viewed, favorited,
rejected, viewing-requested, visited, shared), an optional reason, and the
timestamp. `viewed` is recorded when the agent surfaces an offer in a session,
so the digest can distinguish "seen" from "never shown".
