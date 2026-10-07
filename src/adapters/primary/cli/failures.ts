import { AppError } from "../../../core/errors/app-error.js";
import { ConfigError } from "../../../core/errors/config.js";
import { InvalidDwellingError } from "../../../core/errors/dwelling.js";
import { InvalidListingError } from "../../../core/errors/listing.js";
import { FilterNotFoundError } from "../../../core/errors/filter.js";
import { errorMessage } from "../../../core/errors/message.js";
import {
	InvalidTransitionError,
	InvalidVerdictError,
	OfferNotFoundError,
} from "../../../core/errors/offer.js";
import {
	ProviderError,
	ProviderNotFoundError,
} from "../../../core/errors/provider.js";
import { PublisherError } from "../../../core/errors/publisher.js";
import {
	InvalidProfileValueError,
	ProfilePathError,
} from "../../../core/errors/profile.js";
import { StoreNotInitializedError } from "../../../core/errors/storage.js";
import type { Failure } from "./envelope.js";

interface FailureSpec {
	code: string;
	hint?: string;
}

type AppErrorClass = new (...args: never[]) => AppError;

/** Every application error and its wire code. Add a row here when a new error appears. */
const failureSpecs = new Map<AppErrorClass, FailureSpec>([
	[
		OfferNotFoundError,
		{
			code: "OFFER_NOT_FOUND",
			hint: "run housing-ops queue to list offers",
		},
	],
	[InvalidTransitionError, { code: "INVALID_TRANSITION" }],
	[InvalidVerdictError, { code: "INVALID_VERDICT" }],
	[ProfilePathError, { code: "PROFILE_PATH_NOT_FOUND" }],
	[InvalidProfileValueError, { code: "INVALID_PROFILE_VALUE" }],
	[InvalidDwellingError, { code: "INVALID_DWELLING" }],
	[InvalidListingError, { code: "INVALID_LISTING" }],
	[
		FilterNotFoundError,
		{ code: "FILTER_NOT_FOUND", hint: "run housing-ops filter list" },
	],
	[
		ProviderNotFoundError,
		{
			code: "PROVIDER_NOT_FOUND",
			hint: "run housing-ops validate to check providers.yml",
		},
	],
	[
		ProviderError,
		{
			code: "PROVIDER_ERROR",
			hint: "the command must print the listing interchange on stdout",
		},
	],
	[
		PublisherError,
		{
			code: "PUBLISHER_ERROR",
			hint: "the command must read the event envelope on stdin and exit 0",
		},
	],
	[ConfigError, { code: "CONFIG_ERROR", hint: "run housing-ops validate" }],
	[
		StoreNotInitializedError,
		{ code: "WORKSPACE_NOT_INITIALIZED", hint: "run housing-ops setup" },
	],
]);

/** Maps a thrown error to the wire failure. Errors without a spec become INTERNAL_ERROR. */
export function toFailure(error: unknown): Failure {
	const spec = findSpec(error);
	return {
		code: spec?.code ?? "INTERNAL_ERROR",
		message: errorMessage(error),
		hint: spec?.hint,
	};
}

function findSpec(error: unknown): FailureSpec | undefined {
	for (const [type, spec] of failureSpecs) {
		if (error instanceof type) return spec;
	}
	return undefined;
}
