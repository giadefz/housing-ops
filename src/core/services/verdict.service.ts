import crypto from "node:crypto";
import type { Analysis } from "../domain/analysis.js";
import { recordJudgment } from "../domain/offer.js";
import type { VerdictResult } from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import type { VerdictInput } from "../schemas/requests.js";
import { requireOffer } from "./offer.service.js";

/** One request to record a judgment on an offer. */
export interface VerdictRequest {
	store: OfferStorePort;
	clock: ClockPort;
	id: string;
	input: VerdictInput;
}

/** Records a judgment, moves the offer's status, and appends the analysis. */
export async function setVerdict(
	request: VerdictRequest,
): Promise<VerdictResult> {
	const { store, clock, id, input } = request;
	const offer = await requireOffer(store, id);
	const analysis = toAnalysis(id, input, clock.now());
	await store.saveOffer(recordJudgment(offer, input.tier, input.verdict));
	await store.recordAnalysis(analysis);
	return { analysisId: analysis.id };
}

function toAnalysis(id: string, input: VerdictInput, at: string): Analysis {
	return {
		id: crypto.randomUUID(),
		offerId: id,
		tier: input.tier,
		verdict: input.verdict,
		reason: input.reason,
		pros: input.pros ?? [],
		cons: input.cons ?? [],
		priceAssessment: input.priceAssessment,
		redFlags: input.redFlags,
		recommendation: input.recommendation,
		confidence: input.confidence,
		author: "agent",
		createdAt: at,
	};
}
