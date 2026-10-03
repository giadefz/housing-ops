# Agent flows

Each flow is defined once here and rendered two ways: as `AGENTS.md`/skill
guidance for external harnesses, and later as system-prompt plus tool wiring
for our own frontend. A flow lists its trigger branches, its steps, and the
criterion that ends it — an agent running the flow needs nothing outside this
file plus the api surface.

- **setup** — triggers: first run, "set me up", new country/market.
  Steps: interview (country defaulting to IE, market, budget + currency,
  areas/commute, type/beds/size, deal-breakers, providers pre-checked,
  publisher choice) → write the four config files → init the DB → `doctor`
  until green.
  Done when: `doctor` reports all checks ok and `queue` runs empty without error.
- **review** — triggers: "what's new", a grown queue, after a scan.
  Steps: `scan` if stale → `queue` → walk the to-evaluate list oldest-first,
  triaging each (light verdicts via `verdict set --tier triage`) → deep-analyse
  the keeps → present the shortlist with reasons and prices vs comparables.
  Done when: no offer remains in `pending` that the user hasn't seen, and
  every shown offer has a recorded `viewed`.
- **triage + analyse** — triggers: a pending queue exists.
  Steps: per offer, cheapest judgment first; escalate only survivors to
  analyse; record structured analyses; mark price anomalies and red flags
  explicitly.
  Done when: every queued offer carries a triage verdict, and every kept
  offer carries an analyse record.
- **author-filter** — triggers: "ignore X", "only show me Y", a repeated
  manual rejection pattern.
  Steps: draft the module in `filters.local/` → `filter check` dry-run
  against stored history → show the distribution change → on approval, pin
  it and enable it in `pipeline.yml`.
  Done when: the pin exists, the filter is enabled, and a re-run shows the
  intended distribution shift.
- **add-provider** — triggers: "also check Z", a new country, a degraded
  bundled provider.
  Steps: find the tool or feed → wire a command/module adapter → `provider
  test` on a capped sample → inspect interchange validity → on approval, pin
  (if local code) and enable in `providers.yml`.
  Done when: `scan --provider <id>` stores real canonical offers.
- **tune-prefs** — triggers: "what do I like", repeated holds, "tighten/loosen
  the search".
  Steps: `prefs digest` → compare explicit prefs against favorited-vs-rejected
  stats → propose concrete profile or pipeline edits with predicted effect →
  apply on approval via `prefs set` or YAML edit → `doctor`.
  Done when: the user accepts or rejects each proposal, and accepted edits
  validate.
- **doctor** — triggers: session start, after any config edit, on any
  command failure.
  Steps: run `doctor`, fix findings in order, re-run.
  Done when: all checks green.
- **draft-message** (optional) — triggers: "message the agent about X".
  Steps: draft from the offer + profile context; present for approval.
  Done when: a draft exists. Sending is always the user's own act, outside
  every flow.
