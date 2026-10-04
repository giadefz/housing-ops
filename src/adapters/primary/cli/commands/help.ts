import { ok, type Envelope } from "../envelope.js";

const commands = [
	{ name: "version", status: "implemented" },
	{ name: "validate", status: "implemented" },
	{ name: "offer get <id>", status: "implemented" },
	{ name: "setup", status: "planned (Phase 7)" },
	{ name: "scan", status: "planned (Phase 2–4)" },
	{ name: "queue", status: "planned (Phase 5)" },
	{ name: "verdict set", status: "planned (Phase 5)" },
	{ name: "interact", status: "planned (Phase 5)" },
	{ name: "prefs", status: "planned (Phase 5)" },
	{ name: "filter", status: "planned (Phase 3)" },
	{ name: "provider", status: "planned (Phase 2)" },
	{ name: "publish", status: "planned (Phase 6)" },
];

/** The command menu. */
export function help(): Envelope<unknown> {
	return ok({ commands });
}
