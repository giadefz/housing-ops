import { ok, type Envelope } from "../envelope.js";

const commands = [
	{ name: "version", status: "implemented" },
	{ name: "validate", status: "implemented" },
	{ name: "offer get <id>", status: "implemented" },
	{ name: "scan [--provider id]", status: "implemented" },
	{ name: "setup", status: "planned (Phase 7)" },
	{ name: "queue", status: "implemented" },
	{ name: "verdict set", status: "implemented" },
	{ name: "interact", status: "implemented" },
	{ name: "profile", status: "implemented" },
	{ name: "filter list", status: "implemented" },
	{ name: "filter check <id>", status: "implemented" },
	{ name: "provider list", status: "implemented" },
	{ name: "provider test <id>", status: "implemented" },
	{ name: "publish now", status: "implemented" },
];

/** The command menu. */
export function help(): Envelope<unknown> {
	return ok({ commands });
}
