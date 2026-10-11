# housing-ops — agent guide

A deterministic housing-search backend. It fetches listings from **providers**,
filters them, and stores everything in a local SQLite database. It makes no LLM
calls of its own — you are the interface: you run its commands and read the JSON
they print.

Start a session with `housing-ops validate`: it checks config, database, and
version compatibility, and tells you how to fix anything it finds.

Reach for a doc by the branch that matches:

- **Any task** — `docs/DESIGN.md`: the design index (shape, vocabulary, build
  order, and a component map to every contract).
- **Running a command or reading its output** — `docs/design/api.md`: the
  commands and their JSON envelopes (stdout = envelope, stderr = logs).
- **Changing code** — `docs/HOUSE-RULES.md`: naming, formatting, tests.
- **Adding a source** ("add a provider", "scrape <portal>") —
  `skills/write-provider/`: how to write and test one.
- **Pushing matches elsewhere** ("notify me", "Telegram", "webhook", "add a
  publisher") — `skills/write-publisher/`: how to write a process publisher.

Providers and publishers are user-side: the repo ships the machinery, not the
implementations.
