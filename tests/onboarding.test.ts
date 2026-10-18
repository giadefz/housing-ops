import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Envelope } from "../src/adapters/primary/cli/envelope.js";
import { runCli } from "../src/adapters/primary/cli/run.js";
import { storeFactory } from "../src/adapters/secondary/store-factory.js";
import type {
	InitResult,
	QueueResult,
	ValidationReport,
} from "../src/core/ports/application.port.js";
import { createDefaultApplication } from "../src/defaults.js";

const bootstrap = {
	instance: {
		version: 1,
		name: "Home",
		country: "ie",
		market: "rent",
		interfaces: ["cli"],
	},
	profile: {
		market: "rent",
		country: "ie",
		budget: { max: 2200, currency: "EUR" },
		areas: ["Dublin 8"],
		gate: false,
		recheckHours: 48,
	},
	config: {
		pipeline: {
			version: 1,
			filters: [{ id: "budget", enabled: true, missing: "skip" }],
		},
		providers: { version: 1, providers: [] },
		publishers: { version: 1, publishers: [] },
	},
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

function writeJson(root: string, name: string, value: unknown): string {
	const file = path.join(root, name);
	fs.writeFileSync(file, JSON.stringify(value));
	return file;
}

describe("onboarding end to end", () => {
	it("initializes, validates, and queues from an empty workspace over the CLI", async () => {
		const root = emptyRoot();
		const file = writeJson(root, "init.json", bootstrap);

		const init = await cli<InitResult>(root, "init", "--file", file);
		if (!init.ok) throw new Error(JSON.stringify(init.error));
		expect(init.data).toEqual({
			instance: bootstrap.instance,
			database: "data/housing.db",
		});
		expect(fs.existsSync(path.join(root, "instance.yml"))).toBe(true);

		const validate = await cli<ValidationReport>(root, "validate");
		if (!validate.ok) throw new Error(JSON.stringify(validate.error));
		expect(validate.data.findings.filter((finding) => !finding.ok)).toEqual(
			[],
		);

		const queue = await cli<QueueResult>(root, "queue");
		if (!queue.ok) throw new Error(JSON.stringify(queue.error));
		expect(queue.data).toEqual({ offers: [], total: 0 });
	});

	it("reads the config and profile over the CLI", async () => {
		const root = emptyRoot();
		const file = writeJson(root, "init.json", bootstrap);
		await cli<InitResult>(root, "init", "--file", file);

		const config = await cli(root, "config", "get");
		if (!config.ok) throw new Error(JSON.stringify(config.error));
		expect(config.data).toMatchObject({
			providers: { providers: [] },
		});

		const profile = await cli(root, "profile", "get", "budget.max");
		if (!profile.ok) throw new Error(JSON.stringify(profile.error));
		expect(profile.data).toEqual({ path: "budget.max", value: 2200 });
	});

	it("replaces the shared config over the CLI", async () => {
		const root = emptyRoot();
		const file = writeJson(root, "init.json", bootstrap);
		await cli<InitResult>(root, "init", "--file", file);
		const next = {
			...bootstrap.config,
			pipeline: { version: 1, filters: [] },
		};
		const configFile = writeJson(root, "config.json", next);

		const set = await cli(root, "config", "set", configFile);
		if (!set.ok) throw new Error(JSON.stringify(set.error));
		expect(set.data).toEqual(next);

		const get = await cli(root, "config", "get");
		if (!get.ok) throw new Error(JSON.stringify(get.error));
		expect(get.data).toEqual(next);
	});

	it("refuses to re-init without force, then replaces with force", async () => {
		const root = emptyRoot();
		const file = writeJson(root, "init.json", bootstrap);
		await cli<InitResult>(root, "init", "--file", file);

		const again = await cli(root, "init", "--file", file);
		expect(again.ok).toBe(false);

		const forced = await cli(root, "init", "--file", file, "--force");
		expect(forced.ok).toBe(true);
	});

	it("reports an uninitialized workspace", async () => {
		const root = emptyRoot();
		const config = await cli(root, "config", "get");
		expect(config.ok).toBe(false);
		if (config.ok) throw new Error("expected config failure");
		expect(config.error.code).toBe("WORKSPACE_NOT_INITIALIZED");
	});

	it("reports a missing config and profile in an empty store", async () => {
		const root = emptyRoot();
		storeFactory.init(root);
		const config = await cli(root, "config", "get");
		expect(config.ok).toBe(false);
		if (config.ok) throw new Error("expected config failure");
		expect(config.error.code).toBe("CONFIG_NOT_FOUND");

		const profile = await cli(root, "profile", "get");
		expect(profile.ok).toBe(false);
		if (profile.ok) throw new Error("expected profile failure");
		expect(profile.error.code).toBe("PROFILE_NOT_FOUND");
	});

	it("does not create the store when init is refused", async () => {
		const root = emptyRoot();
		fs.writeFileSync(
			path.join(root, "instance.yml"),
			"version: 1\nname: Home\ncountry: ie\nmarket: rent\n",
		);
		const file = writeJson(root, "init.json", bootstrap);
		const refused = await cli(root, "init", "--file", file);
		expect(refused.ok).toBe(false);
		expect(fs.existsSync(path.join(root, "data", "housing.db"))).toBe(
			false,
		);
	});
});
