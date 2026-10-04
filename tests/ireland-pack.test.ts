import { describe, expect, it } from "vitest";
import { irelandPack } from "../src/countries/ie/pack.js";

describe("ireland pack", () => {
	it("maps Irish portal terms to universal layouts", () => {
		expect(irelandPack.mapLayout("Flat")).toBe("apartment");
		expect(irelandPack.mapLayout("Penthouse")).toBe("penthouse");
		expect(irelandPack.mapLayout("Castle")).toBe("other");
	});
	it("accepts Irish attributes and rejects the rest", () => {
		expect(() =>
			irelandPack.attributeSchema.parse({ ber: "A" }),
		).not.toThrow();
		expect(() => irelandPack.attributeSchema.parse({ ber: "Z" })).toThrow();
	});
});
