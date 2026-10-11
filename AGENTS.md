# housing-ops — agent guide

A deterministic housing-search backend. It fetches listings from **providers**,
filters them, and stores everything in a local SQLite database. It makes no LLM
calls of its own — you are the interface: you run its commands and read the JSON
they print.

## Start here

Run `housing-ops validate` first: it checks config, database, and version
compatibility, and tells you how to fix anything it finds. Green means you're
ready to work.

First session, or a new country/market? Run the **setup** flow: interview the
user, author the five config documents, and write them with
`housing-ops setup`. See `docs/design/flows.md`.

## Stay out of the core

Extend housing-ops from the workspace; never change its code. Everything you are
allowed to create lives beside the core:

- **Config** — the five files in `config/` (profile, pipeline, providers,
  publishers, extensions).
- **Local modules** — `providers.local/` (scrapers and wrappers),
  `filters.local/`, and any command you point a publisher at. Local modules are
  approved and hash-pinned in `config/extensions.yml` before they run.

`src/` is the core: the deterministic engine, its ports, and the bundled
adapters. **Never edit `src/`.** If the core cannot do what the user asked, the
answer is a new local extension or a config change — never a patch to the
engine. Leaving `src/` untouched is what keeps the core replaceable and
upgradeable.

Changing `src/` is a different job — maintaining housing-ops itself, not using
it (see the developer section at the bottom).

## The loop

scan → queue → triage → analyse → interact → digest.

- `housing-ops scan` fetches, filters, stores — deterministic, zero AI cost.
- `housing-ops queue` is the to-evaluate list.
- Judge with `verdict set` — cheap `triage` first, then `analyse` the keepers.
- Record the user's reactions with `interact`; read `profile digest` to learn
  what they like.

Every session — setup, review, triage + analyse, author-filter, add-provider,
tune-profile, validate — is defined in `docs/design/flows.md`. Run the flow end
to end rather than improvising.

## Reach for a doc by the branch that matches

- **Running a command or reading its output** — `docs/design/api.md`: the
  commands and their JSON envelopes (stdout = envelope, stderr = logs).
- **Editing config** — `docs/design/config.md`: the five files, versioned and
  validated.
- **Adding a source** ("add a provider", "scrape <portal>") —
  `skills/write-provider/`: how to write and test one.
- **Pushing matches elsewhere** ("notify me", "Telegram", "webhook", "add a
  publisher") — `skills/write-publisher/`: how to write a process publisher.

Providers and publishers are user-side: the repo ships the machinery, not the
implementations.

## Maintaining housing-ops itself

Design work on the core is separate from using it. The design log, house rules,
and phase plans are maintainer material kept in the gitignored `.internal/`
folder — they are intentionally not part of this repo.
