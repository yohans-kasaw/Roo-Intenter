/**
 * Advanced Token Budget Manager
 * Dynamically limits the size of injected contexts to avoid context window explosion.
 */

export class TokenBudgetManager {
	private readonly maxPromptTokens: number = 80000
	private currentPromptTokens = 0
	private readonly bytesPerToken = 4 // Heuristic: 1 token ~= 4 chars

	constructor(maxTokens: number = 80000) {
		this.maxPromptTokens = maxTokens
	}

	/**
	 * Estimates token count based on character length
	 */
	estimateTokens(text: string): number {
		return Math.ceil(text.length / this.bytesPerToken)
	}

	/**
	 * Records newly added tokens to the budget
	 */
	consumeTokens(amount: number): void {
		this.currentPromptTokens += amount
	}

	/**
	 * Checks if adding the specified text would exceed the budget
	 */
	canFit(text: string): boolean {
		const estimated = this.estimateTokens(text)
		return this.currentPromptTokens + estimated <= this.maxPromptTokens
	}

	/**
	 * Truncates text to fit exactly within the remaining budget
	 */
	truncateToFit(text: string): string {
		const remainingTokens = this.maxPromptTokens - this.currentPromptTokens
		if (remainingTokens <= 0) return "...[TRUNCATED: Out of tokens]..."

		const maxChars = remainingTokens * this.bytesPerToken
		if (text.length <= maxChars) return text

		return text.substring(0, maxChars) + "\n...[TRUNCATED: Context limit reached]..."
	}

	getRemainingBudget(): number {
		return this.maxPromptTokens - this.currentPromptTokens
	}
}
