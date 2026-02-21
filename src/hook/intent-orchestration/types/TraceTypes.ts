/**
 * Trace and ledger types for operation tracking
 * Aligned with the Intent-Driven Architecture Specification
 */

export type MutationClass = "AST_REFACTOR" | "INTENT_EVOLUTION" | "DOCS_UPDATE" | "BUG_FIX"

export interface ContentRange {
	start_line: number
	end_line: number
	content_hash: string
}

export interface RelatedRequirement {
	type: "specification" | "intent" | "issue"
	value: string
}

export interface Contributor {
	entity_type: "AI" | "Human"
	model_identifier?: string
}

export interface Conversation {
	url: string // session_log_id
	contributor: Contributor
	ranges: ContentRange[]
	related: RelatedRequirement[]
	mutation_class?: MutationClass
}

export interface TrackedFile {
	relative_path: string
	conversations: Conversation[]
}

export interface TraceRecord {
	id: string
	timestamp: string
	vcs: {
		revision_id: string
	}
	files: TrackedFile[]
}

export interface SpatialMapEntry {
	file_path: string
	intent_id: string
	operation_type: "read" | "write" | "modify"
	timestamp: string
	line_range?: { start: number; end: number }
	content_hash?: string
}

export interface TraceLedger {
	add(record: TraceRecord): Promise<void>
	load(): Promise<void>
	getAll(): TraceRecord[]
	getByIntent(intentId: string): TraceRecord[]
}

export interface SpatialMap {
	add(entry: SpatialMapEntry): Promise<void>
	load(): Promise<void>
	getAll(): SpatialMapEntry[]
}
