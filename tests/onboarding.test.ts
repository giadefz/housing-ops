import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Envelope } from "../src/adapters/primary/cli/envelope.js";
import { runCli } from "../src/adapters/primary/cli/run.js";
import { CONFIG_FILES } from "../src/core/schemas/index.js";
import type {
	QueueResult,
	SetupResult,
	ValidationReport,
} from "../src/core/ports/application.port.js";
import { createDefaultApplication } from "../src/defaults.js";

const answers = {
	"profile.yml": {
		version: 1,
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
	},
	"pipeline.yml": {
		version: 1,
		filters: [{ id: "budget", enabled: true, missing: "skip" }],
	},
	"providers.yml": { version: 1, providers: [] },
	"publishers.yml": { version: 1, publishers: [] },
	"extensions.yml": { version: 1, approvals: [] },
};

let roots: string[] = [];
afterEach(() => {
	for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
	roots = [];
});

function emptyRoot(): string {
	const root = fs.mkdtempSync(path.join(os.tmpdir(), "housing-ops-"));
	roots.push(root);
	return root;
}

/** Drives one CLI invocation in `root` and returns the parsed stdout envelope. */
async function cli<T>(root: string, ...argv: string[]): Promise<Envelope<T>> {
	const chunks: string[] = [];
	const write = vi
		.spyOn(process.stdout, "write")
		.mockImplementation((chunk): boolean => {
			chunks.push(String(chunk));
			return true;
		});
	try {
		await runCli(await createDefaultApplication(root), [
			"node",
			"housing-ops",
			...argv,
		]);
	} finally {
		write.mockRestore();
	}
	return JSON.parse(chunks.join("")) as Envelope<T>;
}

describe("onboarding end to end", () => {
	it("sets up, validates, and queues from an empty workspace over the CLI", async () => {
		const root = emptyRoot();
		const answersFile = path.join(root, "answers.json");
		fs.writeFileSync(answersFile, JSON.stringify(answers));

		const setup = await cli<SetupResult>(
			root,
			"setup",
			"--answers",
			answersFile,
		);
		if (!setup.ok) throw new Error(JSON.stringify(setup.error));
		expect(setup.data).toEqual({
			files: [...CONFIG_FILES],
			database: "data/housing.db",
		});

		const validate = await cli<ValidationReport>(root, "validate");
		if (!validate.ok) throw new Error(JSON.stringify(validate.error));
		expect(validate.data.findings.filter((finding) => !finding.ok)).toEqual(
			[],
		);

		const queue = await cli<QueueResult>(root, "queue");
		if (!queue.ok) throw new Error(JSON.stringify(queue.error));
		expect(queue.data).toEqual({ offers: [], total: 0 });
	});
});
