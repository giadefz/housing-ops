import { spawn } from "node:child_process";
import type {
	PipelineEvent,
	PipelinePayload,
} from "../../../core/domain/events.js";
import { PublisherError } from "../../../core/errors/publisher.js";
import type { PublisherPort } from "../../../core/ports/publisher.port.js";
import type { PublisherEntry } from "../../../core/schemas/index.js";

/** The document handed to a publisher command on stdin. */
export interface EventEnvelope {
	event: PipelineEvent;
	payload: PipelinePayload;
}

/** Runs an external process as a publisher: the event envelope goes to its stdin. */
export function createProcessPublisher(entry: PublisherEntry): PublisherPort {
	return {
		id: entry.id,
		subscriptions: entry.events,
		publish(event, payload) {
			return runProcess(entry, { event, payload });
		},
	};
}

function runProcess(
	entry: PublisherEntry,
	envelope: EventEnvelope,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(entry.command, entry.args, {
			env: { ...process.env, ...entry.env },
			signal: timeoutSignal(entry.timeoutMs),
		});
		let stderr = "";
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", (error) =>
			reject(new PublisherError(entry.id, error.message, error)),
		);
		child.on("close", (code) => {
			if (code === 0) return resolve();
			reject(
				new PublisherError(
					entry.id,
					`exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`,
				),
			);
		});
		child.stdin.end(JSON.stringify(envelope));
	});
}

function timeoutSignal(timeoutMs: number | undefined): AbortSignal | undefined {
	return timeoutMs === undefined ? undefined : AbortSignal.timeout(timeoutMs);
}
