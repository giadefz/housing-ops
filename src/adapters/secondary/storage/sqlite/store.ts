import Database from "better-sqlite3";
import type { OfferStorePort } from "../../../../core/ports/store.port.js";
import { recordAnalysis } from "./analysis.js";
import { findDwellingByAddressKey, saveDwelling } from "./dwelling.js";
import { recordInteraction } from "./interaction.js";
import { markMarketOutcome } from "./market-event.js";
import { migrate } from "./migrate.js";
import { findOffer, findOfferByListing, saveOffer } from "./offer.js";
import { listQueue } from "./queue.js";
import { finishRun, startRun } from "./run.js";
import { listVerdicts, recordVerdict } from "./verdict.js";

/** Opens a database file, migrating on open. Creates the file when missing. */
export function openStore(databaseFile: string): Database.Database {
	const database = new Database(databaseFile);
	migrate(database);
	return database;
}

/** Closes an open store. */
export function closeStore(database: Database.Database): void {
	database.close();
}

/** Binds the per-entity SQLite DAOs to the store port. */
export function createSqliteStore(database: Database.Database): OfferStorePort {
	return {
		saveDwelling: (dwelling) => saveDwelling(database, dwelling),
		findDwellingByAddressKey: (addressKey) =>
			findDwellingByAddressKey(database, addressKey),
		saveOffer: (offer) => saveOffer(database, offer),
		findOffer: (id) => findOffer(database, id),
		findOfferByListing: (provider, listingId) =>
			findOfferByListing(database, provider, listingId),
		recordVerdict: (offerId, runId, verdict) =>
			recordVerdict(database, offerId, runId, verdict),
		listVerdicts: async (offerId) => listVerdicts(database, offerId),
		recordAnalysis: (analysis) => recordAnalysis(database, analysis),
		recordInteraction: (interaction) =>
			recordInteraction(database, interaction),
		listQueue: async (status, limit) => listQueue(database, status, limit),
		startRun: (provider) => startRun(database, provider),
		finishRun: (runId, stats) => finishRun(database, runId, stats),
		markMarketOutcome: (offerId, outcome, observedAt) =>
			markMarketOutcome(database, offerId, outcome, observedAt),
	};
}
