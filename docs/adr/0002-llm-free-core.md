# LLM-free deterministic core

Status: accepted.

No LLM call ever happens inside the core — not for filtering, not for
normalization, not for background triage. All judgment lives in interface
adapters: today the user's AI harness driving the command surface, tomorrow
our own frontend with its own model client.

This keeps the core testable, headless-runnable, and zero-cost per scan, and
keeps model choice, keys, and spend where they belong — with the interface
owner. The price is explicit: anything needing taste parks as
`pending-judgment` until a session verdicts it.
