import { ok, type Envelope } from "../envelope.js";

const commands = [
	{ name: "version", status: "implemented" },
	{ name: "validate", status: "implemented" },
	{ name: "offer get <id>", status: "implemented" },
	{ name: "scan [--provider id]", status: "implemented" },
	{ name: "setup", status: "planned (Phase 7)" },
	{ name: "queue", status: "planned (Phase 5)" },
	{ name: "verdict set", status: "planned (Phase 5)" },
	{ name: "interact", status: "planned (Phase 5)" },
	{ name: "prefs", status: "planned (Phase 5)" },
	{ name: "filter list", status: "implemented" },
	{ name: "filter check <id>", status: "planned (Phase 3)" },
	{ name: "provider list", status: "implemented" },
	{ name: "provider test <id>", status: "implemented" },
	{ name: "publish", status: "planned (Phase 6)" },
];

/** The command menu. */
export function help(): Envelope<unknown> {
	return ok({ commands });
}
