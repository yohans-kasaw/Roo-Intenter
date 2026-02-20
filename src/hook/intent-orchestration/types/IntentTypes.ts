/**
 * Core intent types for the intent orchestration system
 * Aligned with the Intent-Driven Architecture Specification
 */

export interface IntentDefinition {
	id: string
	name: string
	status: "IN_PROGRESS" | "COMPLETED" | "PENDING"
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
	created_at?: string
	updated_at?: string
}

export interface ActiveIntentsSpec {
	active_intents: IntentDefinition[]
}

export interface SelectedIntent {
	intent_id: string
	selected_at: string
	context_injected: boolean
}
