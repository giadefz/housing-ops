import type {
	WorkspaceFiles,
	WorkspaceReadRequest,
} from "../adapters/secondary/workspace.js";
import type { CountryPack } from "../core/domain/country-pack.js";
import type { ClockPort } from "../core/ports/clock.port.js";
import type { EventBus } from "../core/ports/event-bus.port.js";
import type { FilterPort } from "../core/ports/filter.port.js";
import type { StoreFactory } from "../core/ports/store.port.js";
import type { Instance } from "../core/schemas/instance.js";
import type { StoreSnapshot } from "./store.js";

/** The concrete adapters the application is wired with. */
export interface ApplicationDependencies {
	storeFactory: StoreFactory;
	readWorkspaceFiles: (request: WorkspaceReadRequest) => WorkspaceFiles;
	writeInstance: (root: string, instance: Instance, force: boolean) => void;
	clock: ClockPort;
	pack: CountryPack;
	warn: (message: string) => void;
}

/** What boot reads before wiring: the store snapshot plus the workspace files. */
export interface Boot extends StoreSnapshot {
	workspace: WorkspaceFiles;
}

/** The stable context capability modules receive. */
export interface Wiring {
	root: string;
	storeFactory: StoreFactory;
	writeInstance: ApplicationDependencies["writeInstance"];
	clock: ClockPort;
	pack: CountryPack;
	events: EventBus;
	filters: Map<string, FilterPort>;
	providersText: string | null;
	pipelineText: string | null;
	scanContext: ScanContext;
}

/** The values scan needs that do not depend on the provider or the members. */
export interface ScanContext {
	providersText: string | null;
	events: EventBus;
	pipelineText: string | null;
	pack: CountryPack;
	clock: ClockPort;
	filters: Map<string, FilterPort>;
}
