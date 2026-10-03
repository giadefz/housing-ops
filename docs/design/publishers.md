# Publishers

A publisher carries a pipeline event somewhere else. Publishers never judge
and never mutate the DB — they read events and deliver them.

## The contract

```ts
interface Publisher {
  id: string
  schema: ZodType                // validates this publisher's own config
  publish(event: PipelineEvent, payload: unknown): Promise<void>
}

type PipelineEvent = 'offer.passed' | 'offer.updated' | 'offer.judged'
```

Payloads are the full `offer get` shape for the subject offer plus the event
metadata — a consumer never needs a second call.

## Events

- `offer.passed` — an offer cleared the deterministic pipeline (or the gate,
  when on). The default and usually only subscription.
- `offer.updated` — a known offer changed (price drop, fields, status).
  Price drops are the high-value subscription.
- `offer.judged` — an analysis landed on an offer.

## v1 built-in: webhook

Generic HTTP POST of the event payload, optional HMAC signature header,
three delivery attempts with backoff, failures recorded on the run (never
crashing it). Declared in `providers.yml`'s sibling config with `url`,
`secret?`, `events: [offer.passed]`.

The default terminal stays the to-evaluate queue you check with your agent —
publishers are optional attachments, and a failed delivery never blocks the
pipeline. DynamoDB-push and Telegram are documented future/user-authored
adapters, not v1 scope.
