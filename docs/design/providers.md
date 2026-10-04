# Providers

A provider fetches listings from one source and yields interchange records
(`offer.md`). Providers never judge — judgment is the pipeline's job.

## The port

```ts
interface Provider {
  id: string
  country: string                // 'ie', …
  markets: ('rent' | 'buy')[]
  schema: ZodType                // validates this provider's own config
  fetch(cfg: unknown, ctx: FetchCtx): AsyncIterable<Listing>
}

interface FetchCtx {
  signal: AbortSignal            // timeout + cancellation
  pace: () => Promise<void>      // call between requests; core enforces spacing
  log: (msg: string) => void
}
```

`fetch` streams `Listing` records; the core validates each against the
interchange schema, normalizes to Offer, and routes failures to dead-letter.
A provider that cannot reach its source reports degraded health instead of
throwing the run away — partial results with a health flag beat an all-or-nothing crash.

## Two adapter kinds

**Command adapter (primary).** Declared in `providers.yml`, no code in our
repo:

```yaml
- id: daft
  type: command
  country: ie
  markets: [rent, buy]
  enabled: true
  command: python3
  args: ["-c", "…jsonl wrapper…"]   # core may append constraint args the tool supports
  env: { DAFT_COOKIE: "${DAFT_COOKIE}" }
  output: jsonl                     # jsonl | json | file
  timeout_s: 120
```

Anything runnable works: python, node, a binary. The process's stdout is the
interchange; stderr is captured into the run log. Timeouts kill the process
and mark the run degraded.

**Module adapter.** A TS module: bundled in `src/adapters/secondary/providers/`,
yours in `providers.local/`, for npm libraries or plain HTTP. Same port,
auto-discovered, local wins on id collision.

## Pushdown as arguments

Where the underlying tool supports search constraints (price, beds, area),
the core passes the profile's hard constraints as provider arguments —
declared per provider in `providers.yml` under `constraints:`. Pure
optimization: everything is re-validated locally, and a tool that ignores
constraints still works, just slower.

## Pacing and health

Defaults: ≥3s between requests (`pace()` enforces it), low page ceilings,
per-provider overrides in config only downward. No bot-protection
circumvention: a walled source yields `health: degraded` with the evidence
(status code, challenge page hash), consecutive failures accumulate in
`providers_state`, and `doctor` reports them. Auth- or cookie-gated sources
live in `providers.local/` and load only when explicitly enabled.

## v1 examples

- **daft** (command, `daftlistings` via a `python -c` JSONL wrapper) —
  primary worked example; `daft-scraper` documented as fallback config.
- **myhome** (module, search-page embedded-JSON parsing) — minimal;
  the hosted actor documented as a paid alternative.
- **rent.ie** (module, feed + detail pages) — minimal.
  Each stays thin and replaceable; any entry can point at a different command
  without touching core code.

`provider test <id>` runs the adapter capped (one page / N records) and shows
the interchange sample — the loop used while wiring a new source.
