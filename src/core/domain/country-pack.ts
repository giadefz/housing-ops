import type { z } from "zod";
import type { Address, Attributes, LayoutType, SizeUnit } from "./dwelling.js";

/** Country-specific housing knowledge. Pure: schemas and functions, no I/O. */
export interface CountryPack {
	code: string;
	attributeSchema: z.ZodType<Attributes>;
	defaultCurrency: string;
	defaultSizeUnit: SizeUnit;
	addressKey(address: Address, attributes: Attributes): string;
	mapLayout(providerTerm: string): LayoutType;
	defaultProviders: string[];
}
