import crypto from "node:crypto";
import type {
	Analysis,
	AnalysisTier,
	AnalysisVerdict,
} from "../domain/analysis.js";
import type { PipelineEvent } from "../domain/events.js";
import { recordJudgment, type Offer } from "../domain/offer.js";
import type { VerdictResult } from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { EventBus } from "../ports/event-bus.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import type { VerdictInput } from "../schemas/requests.js";
import { requireOffer } from "./offer.service.js";

/** One request to record a judgment on an offer. */
export interface VerdictRequest {
	store: OfferStorePort;
	clock: ClockPort;
	events: EventBus;
	id: string;
	input: VerdictInput;
}

/** Records a judgment, moves the status, appends the analysis, and emits the milestone. */
export async function setVerdict(
	request: VerdictRequest,
): Promise<VerdictResult> {
	const { store, clock, events, id, input } = request;
	const offer = await requireOffer(store, id);
	const judged = recordJudgment(offer, input.tier, input.verdict);
	const analysis = toAnalysis(id, input, clock.now());
	await store.saveOffer(judged);
	await store.recordAnalysis(analysis);
	await emitJudgment({
		events,
		tier: input.tier,
		verdict: input.verdict,
		judged,
		analysis,
	});
	return { analysisId: analysis.id };
}

interface JudgmentEvent {
	events: EventBus;
	tier: AnalysisTier;
	verdict: AnalysisVerdict;
	judged: Offer;
	analysis: Analysis;
}

async function emitJudgment(source: JudgmentEvent): Promise<void> {
	const event = judgmentEvent(source.tier, source.verdict);
	if (event === null) return;
	await source.events.emit(event, {
		offer: {
			...source.judged,
			analyses: [...source.judged.analyses, source.analysis],
		},
	});
}

/** The milestone a judgment emits, if any. */
function judgmentEvent(
	tier: AnalysisTier,
	verdict: AnalysisVerdict,
): PipelineEvent | null {
	if (tier === "triage" && verdict === "screened") return "offer.screened";
	if (tier === "analyse" && verdict === "shortlist")
		return "offer.shortlisted";
	return null;
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
