import type { FilterPort } from "../ports/filter.port.js";
import { bedroomsFilter } from "./bedrooms.js";
import { budgetFilter } from "./budget.js";
import { locationFilter } from "./location.js";
import { sizeFilter } from "./size.js";
import { typeFilter } from "./type.js";

/** The filters that ship with housing-ops, keyed by id. */
export const bundledFilters = new Map<string, FilterPort>([
	[budgetFilter.id, budgetFilter],
	[bedroomsFilter.id, bedroomsFilter],
	[locationFilter.id, locationFilter],
	[typeFilter.id, typeFilter],
	[sizeFilter.id, sizeFilter],
]);
