# House rules

Binding for every code change in this repo — human or agent.

## Skills

Two skills govern TypeScript here. Their full texts live in the author's
harness (`.agents/skills/`, gitignored); this file is the repo-committed
summary:

- `clean-code` — intention-revealing names; functions under ~20 lines doing
  one thing at one abstraction level; guard clauses instead of `else`;
  comments explain why, never what; exceptions over return codes; never
  pass or return null.
- `typescript-clean-code-cookbook` — no `any` (narrow `unknown`, wrap
  third-party gaps immediately); explicit named types over inline typing;
  two params max (object params beyond that); no boolean params; small
  functions at a single abstraction level; no blank-line-separated blocks
  inside functions — extract them.

When the skills conflict with speed, the skills win. When they conflict
with each other, ask.

- No references to internal docs in code comments — `docs/DESIGN.md`'s
  component map is the single index of where things are documented.
  Comments only when extremely necessary: short, concise, clear.
- Exception: TSDoc over interface definitions (and concept type aliases) —
  one to two lines defining the concept.

## Naming

- Command words (what the user types) are affordances: short, borrowing
  CLI convention (`doctor`, `scan`, `queue`). Borrowing is good UX.
- Code words are domain language: verbs acting on real concepts. Never
  stack an empty verb on a metaphor (`runDoctor`, `doScan`, `performCheck`).
- The sentence test: say it about the real world — "check the system's
  health", "scan the portals", "judge this offer". If you can't, rename.
- Load-bearing words are defined once (ubiquitous language) and reused
  verbatim everywhere: docs, prompts, code.

## Formatting

Prettier enforces style: tabs, width 4 (`useTabs: true, tabWidth: 4`).

- `npm run format` normalizes `src` and `tests`.
- `npm run format:check` must pass before commit.
- Never hand-format what Prettier owns (indentation, quotes, wrapping).
  Review diffs for meaning, not whitespace.

## Verification

- `npm run build` (strict `tsc`) and `npm test` (vitest) stay green.
- New behavior ships with a failing-first test; refactors keep behavior —
  tests are extended, never weakened to fit.
