import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultApplication } from "../src/defaults.js";
import { WorkspaceExistsError } from "../src/core/errors/setup.js";
import { CONFIG_FILES, SetupInputSchema } from "../src/core/schemas/index.js";

const input = SetupInputSchema.parse({
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
});

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

describe("setup end to end", () => {
	it("boots on an empty workspace without a profile", async () => {
		await expect(
			createDefaultApplication(emptyRoot()),
		).resolves.toBeDefined();
	});

	it("writes the workspace and leaves it validating green", async () => {
		const root = emptyRoot();
		const app = await createDefaultApplication(root);
		const result = app.setup(input, false);

		expect(result.files).toEqual([...CONFIG_FILES]);
		expect(result.database).toBe("data/housing.db");
		for (const file of CONFIG_FILES) {
			expect(fs.existsSync(path.join(root, "config", file))).toBe(true);
		}

		const reopened = await createDefaultApplication(root);
		expect(
			reopened.validateWorkspace().findings.filter((f) => !f.ok),
		).toEqual([]);
	});

	it("refuses to overwrite without force, then allows it", async () => {
		const root = emptyRoot();
		(await createDefaultApplication(root)).setup(input, false);
		const app = await createDefaultApplication(root);

		expect(() => app.setup(input, false)).toThrow(WorkspaceExistsError);
		expect(() => app.setup(input, true)).not.toThrow();
	});
});
