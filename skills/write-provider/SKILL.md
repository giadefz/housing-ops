---
name: write-provider
description: Write a provider that fetches listings from a new source. Use when the user asks to add or write a provider, wire a portal, or scrape/import listings from a source (Daft, MyHome, …).
---

# Write a provider

A **provider** fetches listings from one source. You write one as a command that
emits the **interchange** on stdout, plus a `providers.yml` entry, verified with
`provider test`. Providers are user-side: the repo ships the machinery, not
implementations.

Read `docs/design/providers.md` for the boundary (core → port → adapter) and the
config keys, and `docs/design/offer.md` for the interchange fields.

## Steps

1. **Pick the mechanism.** Process adapter (run an external program) or module
   adapter (TypeScript in `providers.local/`). Prefer process when a scraper or
   library already exists.
   Done when: you have chosen the command (or module) you will write.

2. **Write the command** in `providers.local/`. It prints one interchange object
   per JSONL line on **stdout**. Every log, count, and warning goes to **stderr**.
   Done when: running the command by hand puts only listing JSON on stdout.

3. **Add its entry** to `config/providers.yml` — id, country, markets, command,
   args, output; optional `env`, `timeoutMs`. Keys: `docs/design/providers.md`.
   Done when: `housing-ops validate` reports `config.providers.yml` ok.

4. **Test it:** `housing-ops provider test <id>`.
   Done when: it returns `{ fetched, sample }` and every record validated. A
   failed record names itself; fix the command and repeat.

5. **Enable it** (`enabled: true`).

## Gotchas

- **stdout noise.** Libraries often print progress to stdout. Redirect it to
  stderr around the call — `daftlistings` prints "Searching…" there.
- **Library headers.** Some gateways answer a library's default requests with
  HTML, not JSON. Patch browser-like `User-Agent`, and often `Origin`/`Referer`.
- **Messy fields.** Price, bedrooms, and size often arrive as strings
  ("€1,800 per month", "1 & 2 bed", "N/A"). Parse to clean values (or a lower
  bound), and keep the raw record in `extra` so nothing is lost.
