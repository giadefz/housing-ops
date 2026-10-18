import crypto from "node:crypto";
import type {
	Analysis,
	AnalysisTier,
	AnalysisVerdict,
} from "../domain/analysis.js";
import { recordJudgment, type Decision } from "../domain/decision.js";
import type { PipelineEvent } from "../domain/events.js";
import type { Offer } from "../domain/offer.js";
import type { VerdictResult } from "../ports/application.port.js";
import type { ClockPort } from "../ports/clock.port.js";
import type { EventBus } from "../ports/event-bus.port.js";
import type { OfferStorePort } from "../ports/store.port.js";
import type { VerdictInput } from "../schemas/requests.js";
import { findOrOpenDecision, requireOffer } from "./offer.service.js";

/** One request to record a judgment on an offer. */
export interface VerdictRequest {
	store: OfferStorePort;
	clock: ClockPort;
	events: EventBus;
	memberId: string;
	offerId: string;
	input: VerdictInput;
}

/** Records a judgment, moves the decision, appends the analysis, and emits the milestone. */
export async function setVerdict(
	request: VerdictRequest,
): Promise<VerdictResult> {
	const { store, clock, events, memberId, offerId, input } = request;
	const offer = await requireOffer(store, offerId);
	const decision = await findOrOpenDecision(store, memberId, offerId);
	const judged = recordJudgment(decision, input.tier, input.verdict);
	const analysis = toAnalysis(memberId, offerId, input, clock.now());
	await store.saveDecision(judged);
	await store.recordAnalysis(analysis);
	await emitJudgment({
		events,
		tier: input.tier,
		verdict: input.verdict,
		offer,
		decision: judged,
	});
	return { analysisId: analysis.id };
}

interface JudgmentEvent {
	events: EventBus;
	tier: AnalysisTier;
	verdict: AnalysisVerdict;
	offer: Offer;
	decision: Decision;
}

async function emitJudgment(source: JudgmentEvent): Promise<void> {
	const event = judgmentEvent(source.tier, source.verdict);
	if (event === null) return;
	await source.events.emit(event, {
		offer: source.offer,
		decision: source.decision,
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

function toAnalysis(
	memberId: string,
	offerId: string,
	input: VerdictInput,
	at: string,
): Analysis {
	return {
		id: crypto.randomUUID(),
		memberId,
		offerId,
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
