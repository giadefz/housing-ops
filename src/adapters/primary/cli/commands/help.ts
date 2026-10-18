import { ok, type Envelope } from "../envelope.js";

const commands = [
	{ name: "version", status: "implemented" },
	{ name: "validate", status: "implemented" },
	{ name: "offer get <id>", status: "implemented" },
	{ name: "scan [--provider id]", status: "implemented" },
	{ name: "init --file <file>", status: "implemented" },
	{ name: "config get", status: "implemented" },
	{ name: "config set <file>", status: "implemented" },
	{ name: "config import [--name <name>]", status: "implemented" },
	{ name: "queue", status: "implemented" },
	{ name: "feed status", status: "implemented" },
	{ name: "feed fill", status: "implemented" },
	{ name: "feed empty", status: "implemented" },
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
