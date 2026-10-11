---
name: write-publisher
description: Write a publisher that pushes pipeline milestones somewhere (Telegram, an API, a webhook, a Playwright script). Use when the user asks to add a publisher, get matches on Telegram, notify another service, or push new/approved listings.
---

# Write a publisher

A **publisher** carries a pipeline milestone somewhere else — a Telegram bot, an
API you own, a script that books a viewing. You write one as a command that reads
one JSON document on **stdin**, plus a `publishers.yml` entry. Publishers are
user-side: the repo ships the machinery, not implementations.

Read `docs/design/publishers.md` for the contract and config keys.

## Steps

1. **Pick the events** the publisher subscribes to. Fast, pre-agent pushes
   subscribe to `offer.passed`; "only once the agent is comfortable" subscribes
   to `offer.screened`; `offer.shortlisted`, `offer.closed`, and
   `offer.updated` (price drops) are the others.
   Done when: you know which milestone(s) trigger the delivery.

2. **Write the command** — any language. It reads a single JSON document from
   stdin:

   ```json
   { "event": "offer.passed", "payload": { "offer": { "...": "the offer" } } }
   ```

   Read all of stdin first, parse, then act. Exit `0` on success.
   Done when: piping a sample document in runs your delivery.

3. **Add its entry** to `config/publishers.yml` — id, `type: process`, `events`,
   `command`, `args`; optional `env`, `timeoutMs`. Keys:
   `docs/design/publishers.md`.
   Done when: `housing-ops validate` reports `config.publishers.yml` ok.

4. **Test it:** `housing-ops publish now --event <milestone>`. It re-delivers
   that milestone over the stored offers currently in that state.
   Done when: your command received the payload and did its thing.

5. **Enable it** (`enabled: true`).

## Contract

- **stdin, not stdout.** The envelope arrives on stdin. stdout is ignored.
- **Exit code decides.** Non-zero (or a timeout) is a failure: it is logged to
  stderr and the run continues. Your publisher must never crash the scan.
- **Payload is self-contained.** `payload.offer` is the full offer — versions,
  analyses, interactions, both statuses. No second call is needed.
- **Fire-and-forget.** Nothing comes back to the emitter; only the log.

## Gotchas

- **Idempotency.** `publish now` (and re-scans) can deliver the same offer more
  than once. Dedupe by `offer.id` on your side if that matters.
- **Transitions, not every scan.** `offer.passed` fires when an offer *newly*
  clears the filters and `offer.updated` only when a version was appended — not
  on every run.
- **Time-outs.** A slow or hanging script is killed after `timeoutMs`. Set it.
- **Secrets.** Keep tokens in `env` in `publishers.yml`, not in the command.
