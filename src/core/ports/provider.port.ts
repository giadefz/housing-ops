import type { Market } from "../domain/offer.js";

/** Controls for one fetch: cancellation, pacing, and logging. */
export interface FetchContext {
	signal: AbortSignal;
	pace(): Promise<void>;
	log(message: string): void;
}

/** Source of listings. Implemented by the process adapter, module adapters, and local tools. */
export interface ProviderPort {
	id: string;
	country: string;
	markets: Market[];
	fetch(config: unknown, context: FetchContext): AsyncIterable<unknown>;
}
