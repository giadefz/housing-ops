import crypto from "node:crypto";
import {
	isAnalysisTier,
	isAnalysisVerdict,
	type Analysis,
	type AnalysisTier,
	type AnalysisVerdict,
} from "../domain/analysis.js";
import { recordJudgment } from "../domain/offer.js";
import {
	InvalidVerdictError,
	OfferNotFoundError,
	UnknownTierError,
} from "../errors/offer.js";
import type { VerdictInput, VerdictResult } from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { OfferStorePort } from "../ports/store.port.js";

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
	const offer = await store.findOffer(id);
	if (offer === null) throw new OfferNotFoundError(id);
	const tier = parseTier(input.tier);
	const verdict = parseVerdict(input.tier, input.verdict);
	const analysis = toAnalysis({
		id,
		tier,
		verdict,
		input,
		at: clock.now(),
	});
	await store.saveOffer(recordJudgment(offer, tier, verdict));
	await store.recordAnalysis(analysis);
	return { analysisId: analysis.id };
}

function parseTier(value: string): AnalysisTier {
	if (!isAnalysisTier(value)) throw new UnknownTierError(value);
	return value;
}

function parseVerdict(tier: string, value: string): AnalysisVerdict {
	if (!isAnalysisVerdict(value)) throw new InvalidVerdictError(tier, value);
	return value;
}

interface AnalysisSource {
	id: string;
	tier: AnalysisTier;
	verdict: AnalysisVerdict;
	input: VerdictInput;
	at: string;
}

function toAnalysis(source: AnalysisSource): Analysis {
	const { input } = source;
	return {
		id: crypto.randomUUID(),
		offerId: source.id,
		tier: source.tier,
		verdict: source.verdict,
		reason: input.reason,
		pros: input.pros ?? [],
		cons: input.cons ?? [],
		priceAssessment: input.priceAssessment,
		redFlags: input.redFlags,
		recommendation: input.recommendation,
		confidence: input.confidence,
		author: "agent",
		createdAt: source.at,
	};
}
