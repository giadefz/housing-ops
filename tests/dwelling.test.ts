import { describe, expect, it } from "vitest";
import {
	createDwelling,
	toSquareMeters,
	type NewDwelling,
} from "../src/core/domain/dwelling.js";
import { irelandPack } from "../countries/ie/pack.js";

function dwellingInput(): NewDwelling & { id: string } {
	return {
		id: "dw-1",
		address: { freeText: "12 Main Street, Dublin 8" },
		size: { value: 85, unit: "m2" },
		rooms: { bedrooms: 2 },
		layout: "apartment",
		attributes: { ber: "B", eircode: "D08AB12" },
	};
}

describe("createDwelling", () => {
	it("creates a dwelling with pack-validated attributes and a derived key", () => {
		const dwelling = createDwelling(dwellingInput(), irelandPack);
		expect(dwelling.id).toBe("dw-1");
		expect(dwelling.addressKey).toBe("12 main street dublin 8|d08ab12");
		expect(dwelling.attributes).toEqual({ ber: "B", eircode: "D08AB12" });
	});
	it("rejects unknown attribute values", () => {
		const input = dwellingInput();
		input.attributes = { ber: "Z" };
		expect(() => createDwelling(input, irelandPack)).toThrow(/attributes/);
	});
	it("rejects an empty address", () => {
		const input = dwellingInput();
		input.address = { freeText: "   " };
		expect(() => createDwelling(input, irelandPack)).toThrow(/address/);
	});
	it("derives the same key for the same place written differently", () => {
		const first = createDwelling(dwellingInput(), irelandPack);
		const input = dwellingInput();
		input.address = { freeText: "  12   MAIN street, Dublin 8! " };
		const second = createDwelling(input, irelandPack);
		expect(second.addressKey).toBe(first.addressKey);
	});
});

describe("toSquareMeters", () => {
	it("converts square feet", () => {
		expect(toSquareMeters({ value: 1000, unit: "sqft" })).toBeCloseTo(
			92.9,
			1,
		);
	});
	it("passes square meters through", () => {
		expect(toSquareMeters({ value: 85, unit: "m2" })).toBe(85);
	});
});
