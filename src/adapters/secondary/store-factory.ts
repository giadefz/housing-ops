import type { StoreFactory } from "../../core/ports/store.port.js";
import { sqliteStoreFactory } from "./storage/sqlite/factory.js";

/** The default datastore adapter. Swap here (or in the composition root) to plug another. */
export const storeFactory: StoreFactory = sqliteStoreFactory;
