import { InterfaceDisabledError } from "../errors/instance.js";
import type { Instance, InstanceInterface } from "../schemas/instance.js";

/** Throws when an existing instance does not enable the given interface. */
export function assertInterfaceEnabled(
	instance: Instance | null,
	name: InstanceInterface,
): void {
	if (instance === null) return;
	if (!instance.interfaces.includes(name))
		throw new InterfaceDisabledError(name);
}
