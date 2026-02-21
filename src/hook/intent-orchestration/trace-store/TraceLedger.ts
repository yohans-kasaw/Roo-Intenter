import * as fs from "fs/promises"
import * as path from "path"
import { TraceRecord, TraceLedger as ITraceLedger } from "../types/TraceTypes"
import { OrchestrationPaths } from "../intent-store/OrchestrationPaths"

/**
 * TraceLedger - Manages the append-only agent_trace.jsonl file
 * Implements the AI-Native Git layer for traceability
 */
export class TraceLedger implements ITraceLedger {
	private records: TraceRecord[] = []
	private readonly workspaceRoot: string

	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = workspaceRoot
	}

	/**
	 * Add a new record to the ledger and append to JSONL file
	 */
	async add(record: TraceRecord): Promise<void> {
		this.records.push(record)
		const filePath = path.join(this.workspaceRoot, OrchestrationPaths.traceLedger())

		try {
			// Ensure directory exists
			await fs.mkdir(path.dirname(filePath), { recursive: true })

			// Append as a single line in JSONL format
			const line = JSON.stringify(record) + "\n"
			await fs.appendFile(filePath, line, "utf-8")
		} catch (error) {
			console.error(`Failed to write to TraceLedger: ${error}`)
			// Graceful degradation: don't crash if trace writing fails
		}
	}

	/**
	 * Load all records from the JSONL file
	 */
	async load(): Promise<void> {
		const filePath = path.join(this.workspaceRoot, OrchestrationPaths.traceLedger())
		try {
			const content = await fs.readFile(filePath, "utf-8")
			this.records = content
				.split("\n")
				.filter((line) => line.trim().length > 0)
				.map((line) => JSON.parse(line))
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				console.error(`Failed to load TraceLedger: ${error}`)
			}
			this.records = []
		}
	}

	/**
	 * Get all records
	 */
	getAll(): TraceRecord[] {
		return [...this.records]
	}

	/**
	 * Get records associated with a specific intent ID
	 */
	getByIntent(intentId: string): TraceRecord[] {
		return this.records.filter((record) =>
			record.files.some((file) =>
				file.conversations.some((conv) => conv.related.some((rel) => rel.value === intentId)),
			),
		)
	}
}
