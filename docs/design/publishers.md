# Publishers

A publisher carries a pipeline event somewhere else. Publishers never judge
and never mutate the DB — they read events and deliver them.

## The contract

A publisher has an id, a config schema that validates its own config, and a
`publish` step taking an event and a payload. The events are `offer.passed`,
`offer.updated`, and `offer.judged`. Payloads are the full `offer get` shape
for the subject offer plus event metadata — a consumer never needs a second
call, and a failed delivery never blocks the pipeline.

## Events

- `offer.passed` — an offer cleared the deterministic pipeline (or the gate,
  when on). The default and usually only subscription.
- `offer.updated` — a known offer changed (price drop, fields, status).
  Price drops are the high-value subscription.
- `offer.judged` — an analysis landed on an offer.

## v1 built-in: webhook

Generic HTTP POST of the event payload, optional HMAC signature header,
three delivery attempts with backoff, failures recorded on the run (never
crashing it). Declared in the config alongside providers with a url, an
optional secret, and the events it subscribes to.

The default terminal stays the to-evaluate queue you check with your agent —
publishers are optional attachments. DynamoDB-push and Telegram are documented
future/user-authored adapters, not v1 scope.
