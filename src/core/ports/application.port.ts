import type { Listing } from "../domain/listing.js";
import type { Offer } from "../domain/offer.js";
import type { Verdict } from "../domain/verdict.js";

/** Core and api versions, for compatibility checks between core and interfaces. */
export interface VersionInfo {
	core: string;
	api: number;
}

/** One validation finding: what was examined, whether it passed, and the detail or fix. */
export interface Finding {
	name: string;
	ok: boolean;
	detail?: string;
}

/** The complete validation result: every finding in one place. */
export interface ValidationReport {
	findings: Finding[];
}

/** One offer with everything recorded against it. Analyses and interactions ride on the offer. */
export interface OfferDetail {
	offer: Offer;
	verdicts: Verdict[];
}

/** One configured provider, as listed from providers.yml. */
export interface ProviderSummary {
	id: string;
	type: string;
	country: string;
	markets: string[];
	enabled: boolean;
}

/** The result of a capped provider trial. */
export interface ProviderTestResult {
	fetched: number;
	sample: Listing[];
}

/** The result of a scan run. */
export interface ScanResult {
	fetched: number;
	stored: number;
	deadLettered: number;
}

/** One configured filter, as listed from pipeline.yml. */
export interface FilterSummary {
	id: string;
	enabled: boolean;
	missing: "skip" | "fail";
	available: boolean;
}

/** The use-case surface every inbound (primary) adapter drives. Inbound adapters depend on this alone. */
export interface ApplicationPort {
	getVersion(): VersionInfo;
	validateWorkspace(): ValidationReport;
	getOffer(id: string): Promise<OfferDetail>;
	listProviders(): ProviderSummary[];
	listFilters(): FilterSummary[];
	testProvider(id: string): Promise<ProviderTestResult>;
	scan(providerId?: string): Promise<ScanResult>;
}
