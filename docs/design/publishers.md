# Publishers

A publisher carries a pipeline milestone somewhere else: a Telegram bot, your
own API, a Playwright script that books a viewing, a webhook. Publishers never
judge and never mutate the DB.

## Subscription and transport

A publisher has two parts, declared in `publishers.yml`:

- **Subscription (when)** — the `events` it listens to.
- **Transport (how)** — the `type`. v1 ships one: `process`.

There is no separate "trigger type": the trigger is the subscription. Fast
"push as soon as filters clear" and "only after the agent screened it" are the
same mechanism with different `events`.

## The process transport

The core spawns `command` with `args` and `env`, writes one JSON document to its
stdin, and waits for it to exit:

```json
{ "event": "offer.passed", "payload": { "offer": { "...": "the offer" } } }
```

- Exit `0` → delivered.
- Non-zero exit, timeout, or spawn error → the failure is logged to stderr and
  the run continues. A publisher never blocks a scan or a judgment.

Anything that reads stdin is a publisher: Python, Node, `curl`, a Playwright
script. The webhook is an example script, not a bundled adapter (D41, D57).

## Events

The milestones, each carrying `{ offer }` — the offer with its versions,
analyses, and interactions, so a consumer never needs a second call:

- `offer.passed` — an offer newly clears the filters (status `passed` or
  `pending`). The fast, pre-agent signal.
- `offer.screened` — triage said `screened`.
- `offer.shortlisted` — analysis said `shortlist`.
- `offer.closed` — the listing is `let`, `sold`, or `gone`.
- `offer.updated` — a known listing changed; a new version was recorded.

The payload type is tied to the event in code (`PipelineEventPayloads`), so
adding an event without a payload is a compile error.

## Delivery

Events go through an in-process event bus built once at startup. Each publisher
is registered for its `events`. Delivery is best-effort: handlers run in order,
and one failing handler is logged without stopping the others or the emitter.

`publish now --event <milestone> [--limit n]` re-delivers a state milestone over
the stored offers currently in that state. It accepts `offer.passed`,
`offer.screened`, `offer.shortlisted`, and `offer.closed`; `offer.updated` is a
change, not a state, so it is not re-publishable.

## Configuration

`publishers.yml` (version 1) is its own config file, separate from
`providers.yml`:

```yaml
version: 1
publishers:
  - id: telegram-fast
    type: process
    enabled: true
    events: [offer.passed]
    command: python
    args: [publish/telegram.py]
    env:
      TELEGRAM_TOKEN: "..."
```

`timeoutMs` is optional. A disabled publisher is parsed but not registered.
