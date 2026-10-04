import { describe, expect, it } from "vitest";
import { getVersion } from "../src/core/version.js";

describe("version", () => {
	it("reports api 1", () => {
		const report = getVersion();
		expect(report.api).toBe(1);
		expect(report.core).toMatch(/^\d+\.\d+\.\d+$/);
	});
});
