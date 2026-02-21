/**
 * ActiveIntentsSchema - Validation for active_intents.yaml
 * Aligned with the research documentation
 */

import type { IntentDefinition, ActiveIntentsSpec } from "../types/IntentTypes"

export class ActiveIntentsSchema {
	/**
	 * Validate the parsed YAML structure
	 */
	static validate(data: unknown): ActiveIntentsSpec {
		if (!data || typeof data !== "object") {
			throw new Error("Invalid active_intents.yaml: must be an object")
		}

		const spec = data as Record<string, unknown>

		if (!Array.isArray(spec.active_intents)) {
			throw new Error("Invalid active_intents.yaml: active_intents must be an array")
		}

		const validatedIntents: IntentDefinition[] = spec.active_intents.map((intent, index) =>
			this.validateIntent(intent, index),
		)

		return {
			active_intents: validatedIntents,
		}
	}

	/**
	 * Validate a single intent definition
	 */
	private static validateIntent(intent: unknown, index: number): IntentDefinition {
		if (!intent || typeof intent !== "object") {
			throw new Error(`Invalid intent at index ${index}: must be an object`)
		}

		const def = intent as Record<string, unknown>

		// Required fields per research
		const requiredFields = ["id", "name", "status", "owned_scope", "constraints", "acceptance_criteria"]
		for (const field of requiredFields) {
			if (!(field in def)) {
				throw new Error(`Invalid intent at index ${index}: missing required field '${field}'`)
			}
		}

		// Validate status
		const validStatuses = ["IN_PROGRESS", "COMPLETED", "PENDING"]
		if (!validStatuses.includes(def.status as string)) {
			throw new Error(`Invalid intent at index ${index}: status must be one of ${validStatuses.join(", ")}`)
		}

		// Validate arrays
		const arrayFields = ["owned_scope", "constraints", "acceptance_criteria"]
		for (const field of arrayFields) {
			if (!Array.isArray(def[field])) {
				throw new Error(`Invalid intent at index ${index}: ${field} must be an array`)
			}
		}

		return {
			id: String(def.id),
			name: String(def.name),
			status: def.status as "IN_PROGRESS" | "COMPLETED" | "PENDING",
			owned_scope: (def.owned_scope as unknown[]).map(String),
			constraints: (def.constraints as unknown[]).map(String),
			acceptance_criteria: (def.acceptance_criteria as unknown[]).map(String),
			created_at: def.created_at ? String(def.created_at) : new Date().toISOString(),
			updated_at: def.updated_at ? String(def.updated_at) : new Date().toISOString(),
		}
	}
}
