import { IntentStore } from "../intent-store/IntentStore"
import { KnowledgeStore } from "../knowledge-store/KnowledgeStore"
import { SpatialMap } from "../trace-store/SpatialMap"
import { TokenBudgetManager } from "./TokenBudgetManager"

/**
 * ContextInjector
 * Dynamically constructs the <intent_context> block based on active intents,
 * spatial density (who owns what), and shared knowledge lessons.
 */
export class ContextInjector {
	private intentStore: IntentStore
	private knowledgeStore: KnowledgeStore
	private spatialMap: SpatialMap
	private tokenManager: TokenBudgetManager

	constructor(intentStore: IntentStore, knowledgeStore: KnowledgeStore, spatialMap: SpatialMap) {
		this.intentStore = intentStore
		this.knowledgeStore = knowledgeStore
		this.spatialMap = spatialMap
		this.tokenManager = new TokenBudgetManager(20000) // 20k token limit for injected context
	}

	async buildDynamicPrompt(intentId: string): Promise<string> {
		const intent = this.intentStore.getIntentById(intentId)
		if (!intent) {
			throw new Error(`Cannot build context: Intent ${intentId} not found.`)
		}

		let prompt = `<intent_context id="${intent.id}">\n`
		prompt += `  <name>${intent.name}</name>\n`
		prompt += `  <status>${intent.status}</status>\n`

		// 1. Inject Scope and Constraints
		prompt += `  <owned_scope>\n`
		intent.owned_scope.forEach((s) => (prompt += `    <pattern>${s}</pattern>\n`))
		prompt += `  </owned_scope>\n`

		prompt += `  <constraints>\n`
		intent.constraints.forEach((c) => (prompt += `    <constraint>${c}</constraint>\n`))
		prompt += `  </constraints>\n`

		prompt += `  <acceptance_criteria>\n`
		intent.acceptance_criteria.forEach((ac) => (prompt += `    <criteria>${ac}</criteria>\n`))
		prompt += `  </acceptance_criteria>\n`

		// 2. Inject Spatial Map Context (Files previously modified by this intent)
		try {
			await this.spatialMap.load()
			const relatedFiles = this.spatialMap.getByIntent(intentId)
			if (relatedFiles.length > 0) {
				prompt += `  <spatial_context>\n`
				prompt += `    <!-- The following files are mapped to this intent -->\n`
				const uniqueFiles = Array.from(new Set(relatedFiles.map((rf) => rf.file_path)))
				uniqueFiles.forEach((f) => (prompt += `    <file>${f}</file>\n`))
				prompt += `  </spatial_context>\n`
			}
		} catch (e) {
			console.warn("Failed to inject spatial context", e)
		}

		// 3. Inject Lessons Learned from Shared Brain
		try {
			const knowledge = await this.knowledgeStore.readAll()
			if (knowledge) {
				// Filter for highly relevant lessons if we had a vector DB, but for now inject last 1000 chars
				const relevantKnowledge = knowledge.slice(-1000)
				prompt += `  <shared_brain_lessons>\n`
				prompt += `    <![CDATA[\n${relevantKnowledge}\n    ]]>\n`
				prompt += `  </shared_brain_lessons>\n`
			}
		} catch (e) {
			console.warn("Failed to inject knowledge store context", e)
		}

		prompt += `</intent_context>`

		// Truncate if it exceeds budget
		if (!this.tokenManager.canFit(prompt)) {
			prompt = this.tokenManager.truncateToFit(prompt)
		}

		this.tokenManager.consumeTokens(this.tokenManager.estimateTokens(prompt))
		return prompt
	}
}
