import { AppError } from "./app-error.js";

/** Thrown when init would replace an existing instance file without force. */
export class InstanceExistsError extends AppError {
	constructor(root: string) {
		super(
			`instance.yml already exists under ${root} — pass --force to replace it`,
		);
		this.name = "InstanceExistsError";
	}
}

/** Thrown when an interface is not enabled in instance.yml. */
export class InterfaceDisabledError extends AppError {
	constructor(name: string) {
		super(`interface ${name} is not enabled in instance.yml`);
		this.name = "InterfaceDisabledError";
	}
}
