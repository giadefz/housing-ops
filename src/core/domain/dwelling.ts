import type { CountryPack } from "./country-pack.js";

/** A physical place someone could live. Aggregate root. Identity is the normalized address key. */
export interface Dwelling {
	id: string;
	addressKey: string;
	address: Address;
	size?: Size;
	rooms?: Rooms;
	layout: LayoutType;
	yearBuilt?: number;
	floor?: number;
	floorsTotal?: number;
	attributes: Attributes;
}

/** A street-level location. The address key derives from freeText. */
export interface Address {
	freeText: string;
	locality?: string;
	region?: string;
	geo?: GeoPoint;
}

/** Coordinates. */
export interface GeoPoint {
	lat: number;
	lng: number;
}

/** A floor area with its unit. */
export interface Size {
	value: number;
	unit: SizeUnit;
}

/** Square meters or square feet. */
export type SizeUnit = "m2" | "sqft";

/** Bedroom and bathroom counts. Present only when at least one is known. */
export interface Rooms {
	bedrooms?: number;
	bathrooms?: number;
}

/** All coarse universal layouts. Single source for the LayoutType union. */
export const LAYOUT_TYPES = [
	"apartment",
	"penthouse",
	"studio",
	"duplex",
	"terrace",
	"house",
	"other",
] as const;

/** Coarse universal layouts. Provider terms map onto these via the country pack. */
export type LayoutType = (typeof LAYOUT_TYPES)[number];

/** Country-specific facts, validated against the active country pack schema. */
export type Attributes = Record<string, unknown>;

/** Dwelling facts without identity. The store assigns the id after address resolution. */
export interface NewDwelling {
	address: Address;
	size?: Size;
	rooms?: Rooms;
	layout: LayoutType;
	yearBuilt?: number;
	floor?: number;
	floorsTotal?: number;
	attributes: unknown;
}

/** Rejected dwelling facts carry the reason. */
export class InvalidDwellingError extends Error {
	constructor(reason: string) {
		super(`invalid dwelling: ${reason}`);
		this.name = "InvalidDwellingError";
	}
}

const SQFT_IN_M2 = 0.092903;

export function toSquareMeters(size: Size): number {
	if (size.unit === "m2") return size.value;
	return size.value * SQFT_IN_M2;
}

export function createDwelling(
	input: NewDwelling & { id: string },
	pack: CountryPack,
): Dwelling {
	rejectEmptyAddress(input.address);
	rejectInvalidSize(input.size);
	rejectInvalidRooms(input.rooms);
	const attributes = parseAttributes(input.attributes, pack);
	return {
		id: input.id,
		addressKey: pack.addressKey(input.address, attributes),
		address: input.address,
		size: input.size,
		rooms: input.rooms,
		layout: input.layout,
		yearBuilt: input.yearBuilt,
		floor: input.floor,
		floorsTotal: input.floorsTotal,
		attributes,
	};
}

function rejectEmptyAddress(address: Address): void {
	if (address.freeText.trim().length === 0)
		throw new InvalidDwellingError("address is empty");
}

function rejectInvalidSize(size: Size | undefined): void {
	if (size !== undefined && size.value <= 0) {
		throw new InvalidDwellingError(`size must be positive: ${size.value}`);
	}
}

function rejectInvalidRooms(rooms: Rooms | undefined): void {
	for (const count of [rooms?.bedrooms, rooms?.bathrooms]) {
		if (count !== undefined && (!Number.isInteger(count) || count < 0)) {
			throw new InvalidDwellingError(
				`room counts must be whole numbers: ${count}`,
			);
		}
	}
}

function parseAttributes(attributes: unknown, pack: CountryPack): Attributes {
	const parsed = pack.attributeSchema.safeParse(attributes);
	if (!parsed.success) {
		throw new InvalidDwellingError(
			`attributes rejected by ${pack.code} pack: ${parsed.error.message}`,
		);
	}
	return parsed.data;
}
