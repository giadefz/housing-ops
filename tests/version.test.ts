import { describe, expect, it } from "vitest";
import { getVersion } from "../src/core/version.js";

describe("version", () => {
	it("reports api 2", () => {
		const report = getVersion();
		expect(report.api).toBe(2);
		expect(report.core).toMatch(/^\d+\.\d+\.\d+$/);
	});
});
