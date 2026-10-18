import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	instancePath,
	parseInstance,
	readInstanceText,
	writeInstance,
} from "../src/adapters/secondary/instance.js";
import {
	InstanceExistsError,
	InterfaceDisabledError,
} from "../src/core/errors/instance.js";
import { assertInterfaceEnabled } from "../src/core/services/instance.service.js";
import type { Instance } from "../src/core/schemas/instance.js";

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

function instanceFixture(): Instance {
	return {
		version: 1,
		name: "Home",
		country: "ie",
		market: "rent",
		interfaces: ["cli"],
	};
}

describe("instance file", () => {
	it("writes, reads, and parses instance.yml", () => {
		const root = emptyRoot();
		expect(readInstanceText(root)).toBeNull();
		expect(fs.existsSync(instancePath(root))).toBe(false);
		writeInstance(root, instanceFixture());
		const text = readInstanceText(root);
		if (text === null) throw new Error("instance.yml not written");
		expect(parseInstance(text)).toEqual(instanceFixture());
	});

	it("refuses to replace an existing instance without force", () => {
		const root = emptyRoot();
		writeInstance(root, instanceFixture());
		expect(() => writeInstance(root, instanceFixture())).toThrow(
			InstanceExistsError,
		);
		expect(() =>
			writeInstance(root, instanceFixture(), true),
		).not.toThrow();
	});

	it("rejects an invalid instance document", () => {
		expect(() => parseInstance("version: 2\n")).toThrow(/instance.yml/);
	});

	it("rejects an instance with no interfaces", () => {
		expect(() =>
			parseInstance(
				"version: 1\nname: Home\ncountry: ie\nmarket: rent\ninterfaces: []\n",
			),
		).toThrow(/instance.yml/);
	});

	it("requires an interface only when an instance exists", () => {
		expect(() => assertInterfaceEnabled(null, "cli")).not.toThrow();
		expect(() =>
			assertInterfaceEnabled(instanceFixture(), "cli"),
		).not.toThrow();
		expect(() =>
			assertInterfaceEnabled(
				{ ...instanceFixture(), interfaces: ["http"] },
				"cli",
			),
		).toThrow(InterfaceDisabledError);
	});
});
