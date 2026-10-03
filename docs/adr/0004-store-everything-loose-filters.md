# Store everything, filter loosely, let the agent read

Status: accepted.

Every listing is stored with its per-filter verdicts — passes and rejections
alike — and deterministic filters stay deliberately loose with fail-open
(`skip`) defaults on missing data. Rejections are training signal, not
garbage; a missing field must never kill a listing the agent could have
judged.

Consequence: the to-evaluate queue is sizeable by design, and the digest
queries must stay cheap as history grows. Hard constraints opt into
fail-closed per filter, explicitly, in config.
