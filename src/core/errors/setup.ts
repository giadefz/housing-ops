import { AppError } from "./app-error.js";

/** Thrown when setup would overwrite an already-initialised workspace without force. */
export class WorkspaceExistsError extends AppError {
	constructor(root: string) {
		super(
			`workspace already set up under ${root} — pass --force to overwrite`,
		);
		this.name = "WorkspaceExistsError";
	}
}
