# Phase 6 — publishers + gate

Plan for the implementing agent. Before starting, read `docs/design/publishers.md`
and `docs/design/api.md`. Decisions settled 2026-10-07 (D57–D60).

## Done when

- A publisher subscribed to an event receives the payload when that milestone
  happens — from a scan or a judgment — without blocking the run.
- `publish now --event ...` re-delivers an event over stored offers.
- Gate on/off is verified: a gate-off run never parks a `pending` offer.

## Model (D57, D58)

One `PublisherPort`; a publisher's **transport** is its `type` (v1: `process`
only) and its **trigger** is its `events` subscription.

- Process transport: the core writes the event payload (JSON) to the command's
  stdin; exit 0 = delivered, non-zero = failure (logged, never blocking).
- Events: `offer.passed` (filters cleared → `passed` or `pending`),
  `offer.screened`, `offer.shortlisted`, `offer.closed`, `offer.updated`.
  `offer.judged` is dropped.

## Config (D59)

`publishers.yml` (version 1) — a fifth config file:

```yaml
publishers:
  - id: telegram-fast
    type: process
    enabled: true
    events: [offer.passed]
    command: python
    args: [publish/telegram.py]
    env: { TELEGRAM_TOKEN: "…" }
```

## What already exists (do not rebuild)

- `PublisherPort` (`core/ports/publisher.port.ts`) and `PipelineEvent`
  (`core/domain/events.ts`).
- The design in `publishers.md`; the gate mechanics in `scan.service.ts`
  `judge()`.

## Slices

### 6a — config + registry

`PublishersFileSchema` (version 1, `publishers: [...]`) + `PublisherEntrySchema`
(`id`, `type: process`, `enabled`, `events`, `command`, `args`, `env`,
`timeoutMs`). Add `publishers.yml` to `CONFIG_FILES`, `ConfigSchemas`,
`readWorkspace`, and `validate`. A registry parses the file into entries.
Done when: `validate` reports `publishers.yml` and a malformed entry fails loudly.

### 6b — process adapter + `deliver`

`createProcessPublisher(entry, runner)` implementing `PublisherPort`: writes the
event payload to the command's stdin, maps exit code to success/failure, honours
`timeoutMs`. A `deliver(publishers, event, payload)` helper filters by
subscription and runs each best-effort, returning per-publisher ok — a failure
is logged, never thrown.
Done when: a fake command receives the payload; a failing command is reported,
not thrown.

### 6c — scan emits events

`scan.service` emits `offer.passed` when an offer newly clears the filters, and
`offer.updated` when `nextVersions` appended a version. Events go through the
event bus; a failed handler is logged and never blocks the run.
Done when: a subscribed publisher receives `offer.passed` for a new pass and
`offer.updated` for a changed relist; a broken handler does not fail the scan.

### 6d — judgment and closure events

`verdict set` emits `offer.screened` (triage) / `offer.shortlisted` (analyse);
`markOutcome` emits `offer.closed`.
Done when: a subscribed publisher receives each when the transition happens.

### 6e — `publish now`

`publish now [--event] [--limit]` re-delivers an event over eligible stored
offers (default event `offer.passed`). CLI per `api.md`.
Done when: it re-delivers to a subscriber and reports `{ publisher, event,
offer_id, ok }` rows.

### 6f — gate verification + docs

A scan test proving gate off never yields `pending` and gate on parks `pending`.
Update `publishers.md`, `config.md`, `api.md`, `DESIGN.md`, `help.ts`.

### 6g — write-publisher skill

`skills/write-publisher/SKILL.md` (product skill, D42): how to write a process
publisher — the event subscription, the stdin payload contract, the exit-code
convention, and worked examples (Telegram, `curl`, a Playwright script).

## Open decisions

- None.
