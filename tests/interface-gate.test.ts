import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeInstance } from "../src/adapters/secondary/instance.js";
import { InterfaceDisabledError } from "../src/core/errors/instance.js";
import type {
	Instance,
	InstanceInterface,
} from "../src/core/schemas/instance.js";
import { createApplication } from "../src/bundled.js";

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

function instanceFixture(interfaces: InstanceInterface[]): Instance {
	return {
		version: 1,
		name: "Home",
		country: "ie",
		market: "rent",
		interfaces,
	};
}

describe("interface gate", () => {
	it("starts the CLI when instance.yml enables it", async () => {
		const root = emptyRoot();
		writeInstance(root, instanceFixture(["cli"]));
		await expect(createApplication(root)).resolves.toBeDefined();
	});

	it("refuses to start the CLI when instance.yml disables it", async () => {
		const root = emptyRoot();
		writeInstance(root, instanceFixture(["http"]));
		await expect(createApplication(root)).rejects.toThrow(
			InterfaceDisabledError,
		);
	});

	it("starts before instance.yml exists", async () => {
		await expect(createApplication(emptyRoot())).resolves.toBeDefined();
	});
});
