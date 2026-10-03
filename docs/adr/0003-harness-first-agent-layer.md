# Harness-first agent layer, flows defined once

Status: accepted.

The v1 interface is the user's own AI CLI, reached through one canonical
`AGENTS.md` plus thin skill shims (opencode, Claude Code). Every agent flow
(onboarding, review, triage, authoring, tuning) is defined once as a
declarative definition and rendered for harnesses now, for our own
in-process agent later — never forked per harness.

Considered options: an in-process agent loop (rejected — drags model choice,
keys, and cost into the core) and a prompt-kit with no typed core (rejected —
that is exactly the career-ops weakness we set out to fix).
