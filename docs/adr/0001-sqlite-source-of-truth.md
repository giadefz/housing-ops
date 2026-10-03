# SQLite as the source of truth

Status: accepted.

career-ops keeps human-readable Markdown/TSV files canonical and treats
SQLite as a derived index that "will never become a primary store — not even
opt-in". We invert this: a single-file SQLite database (`data/housing.db`,
WAL, single writer) behind a `StoragePort` is the source of truth, with
SQLite as the default adapter and cloud/durable stores pluggable later.

History-preserving queries — per-filter verdicts, versioned snapshots,
price changes, favorited-vs-rejected stats — are relational work; files make
every one of them a parsing project. Human readability is recovered through
exports (`offer get`, JSONL dumps), not by making exports the store.
