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

/** The use-case surface every inbound (primary) adapter drives. Inbound adapters depend on this alone. */
export interface ApplicationPort {
	getVersion(): VersionInfo;
	validateWorkspace(): ValidationReport;
	getOffer(id: string): Promise<OfferDetail>;
}
