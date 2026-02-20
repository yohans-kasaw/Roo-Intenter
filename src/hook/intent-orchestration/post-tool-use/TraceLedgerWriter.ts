import { TraceRecord, TraceLedger } from "../types/TraceTypes"

/**
 * TraceLedgerWriter - Specialized writer for trace records
 * Decouples the hook logic from the persistence implementation
 */
export class TraceLedgerWriter {
	private ledger: TraceLedger

	constructor(ledger: TraceLedger) {
		this.ledger = ledger
	}

	/**
	 * Write a trace record to the ledger
	 */
	async write(record: TraceRecord): Promise<void> {
		try {
			await this.ledger.add(record)
		} catch (error) {
			console.error(`TraceLedgerWriter failed: ${error}`)
		}
	}
}
