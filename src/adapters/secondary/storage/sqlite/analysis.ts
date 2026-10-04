import type Database from "better-sqlite3";
import { z } from "zod";
import {
	ANALYSIS_AUTHORS,
	ANALYSIS_TIERS,
	ANALYSIS_VERDICTS,
} from "../../../../core/domain/analysis.js";
import type { Analysis } from "../../../../core/domain/analysis.js";
import type { TableDefinition } from "./migrate.js";
import {
	CorruptRecordError,
	parseEnum,
	parseJson,
	requireJson,
	recordId,
} from "./record.js";

/** Analyses table. Recorded judgments on offers, cheap or deep, append-only. */
export const analysisTable: TableDefinition = {
	table: "analyses",
	dependsOn: ["offers"],
	createTable: `
CREATE TABLE analyses (
	id TEXT PRIMARY KEY,
	offer_id TEXT NOT NULL REFERENCES offers(id),
	tier TEXT NOT NULL,
	verdict TEXT NOT NULL,
	reason TEXT NOT NULL DEFAULT '',
	pros TEXT NOT NULL,
	cons TEXT NOT NULL,
	price_assessment TEXT,
	red_flags TEXT,
	recommendation TEXT,
	confidence REAL,
	author TEXT NOT NULL,
	created_at TEXT NOT NULL
);`,
};

const AnalysisRecordSchema = z.object({
	id: z.string(),
	offer_id: z.string(),
	tier: z.string(),
	verdict: z.string(),
	reason: z.string(),
	pros: z.string(),
	cons: z.string(),
	price_assessment: z.string().nullable(),
	red_flags: z.string().nullable(),
	recommendation: z.string().nullable(),
	confidence: z.number().nullable(),
	author: z.string(),
	created_at: z.string(),
});

/** Analyses record DTO. JSON columns are text, absent values are null. */
export type AnalysisRecord = z.infer<typeof AnalysisRecordSchema>;

function toRecord(analysis: Analysis): AnalysisRecord {
	return {
		id: analysis.id,
		offer_id: analysis.offerId,
		tier: analysis.tier,
		verdict: analysis.verdict,
		reason: analysis.reason,
		pros: JSON.stringify(analysis.pros),
		cons: JSON.stringify(analysis.cons),
		price_assessment: analysis.priceAssessment ?? null,
		red_flags:
			analysis.redFlags === undefined
				? null
				: JSON.stringify(analysis.redFlags),
		recommendation: analysis.recommendation ?? null,
		confidence: analysis.confidence ?? null,
		author: analysis.author,
		created_at: analysis.createdAt,
	};
}

function toDomain(record: unknown): Analysis {
	const parsed = AnalysisRecordSchema.safeParse(record);
	if (!parsed.success)
		throw new CorruptRecordError(
			"analyses",
			recordId(record),
			parsed.error.message,
		);
	const valid = parsed.data;
	return {
		id: valid.id,
		offerId: valid.offer_id,
		tier: parseEnum(
			"analyses",
			valid.id,
			"tier",
			valid.tier,
			ANALYSIS_TIERS,
		),
		verdict: parseEnum(
			"analyses",
			valid.id,
			"verdict",
			valid.verdict,
			ANALYSIS_VERDICTS,
		),
		reason: valid.reason,
		pros: requireJson<string[]>("analyses", valid.id, "pros", valid.pros),
		cons: requireJson<string[]>("analyses", valid.id, "cons", valid.cons),
		priceAssessment: valid.price_assessment ?? undefined,
		redFlags: parseJson<string[]>(
			"analyses",
			valid.id,
			"red_flags",
			valid.red_flags,
		),
		recommendation: valid.recommendation ?? undefined,
		confidence: valid.confidence ?? undefined,
		author: parseEnum(
			"analyses",
			valid.id,
			"author",
			valid.author,
			ANALYSIS_AUTHORS,
		),
		createdAt: valid.created_at,
	};
}

/** Appends an analysis. */
export async function recordAnalysis(
	database: Database.Database,
	analysis: Analysis,
): Promise<void> {
	const record = toRecord(analysis);
	database
		.prepare(
			`INSERT INTO analyses (id, offer_id, tier, verdict, reason, pros, cons, price_assessment, red_flags, recommendation, confidence, author, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.run(
			record.id,
			record.offer_id,
			record.tier,
			record.verdict,
			record.reason,
			record.pros,
			record.cons,
			record.price_assessment,
			record.red_flags,
			record.recommendation,
			record.confidence,
			record.author,
			record.created_at,
		);
}

/** Lists an offer's analyses in order. */
export function listAnalyses(
	database: Database.Database,
	offerId: string,
): Analysis[] {
	const records: unknown[] = database
		.prepare(
			"SELECT * FROM analyses WHERE offer_id = ? ORDER BY created_at",
		)
		.all(offerId);
	return records.map((record) => toDomain(record));
}
