/**
 * Orchestration State Machine
 * Formally enforces the "Two-Stage Flow" (Checkout -> Act) to prevent Context Rot.
 */

export enum OrchestrationState {
	IDLE = "IDLE",
	ANALYSIS = "ANALYSIS",
	INTENT_SELECTED = "INTENT_SELECTED",
	CONTEXT_INJECTED = "CONTEXT_INJECTED",
	MUTATING = "MUTATING",
	AWAITING_VALIDATION = "AWAITING_VALIDATION",
}

export class OrchestrationStateMachine {
	private currentState: OrchestrationState = OrchestrationState.IDLE
	private currentIntentId: string | null = null

	/**
	 * Transition the state machine based on the tool called.
	 * Blocks unauthorized transitions with explicit error messages.
	 */
	transition(toolName: string, args: Record<string, any>): void {
		if (toolName === "select_active_intent") {
			if (this.currentState === OrchestrationState.MUTATING) {
				throw new Error(
					"Cannot select a new intent while mutations are in progress. Finalize current intent first.",
				)
			}
			this.currentState = OrchestrationState.INTENT_SELECTED
			this.currentIntentId = args.intent_id
			return
		}

		if (this.isMutationTool(toolName)) {
			if (
				this.currentState !== OrchestrationState.INTENT_SELECTED &&
				this.currentState !== OrchestrationState.CONTEXT_INJECTED &&
				this.currentState !== OrchestrationState.MUTATING
			) {
				throw new Error(
					`[Gatekeeper Block] Cannot execute mutating tool '${toolName}'. Current state is '${this.currentState}'. You must call 'select_active_intent' first to enter INTENT_SELECTED state.`,
				)
			}
			this.currentState = OrchestrationState.MUTATING
			return
		}

		if (toolName === "attempt_completion") {
			this.currentState = OrchestrationState.AWAITING_VALIDATION
			return
		}

		// Read-only tools (search_files, read_file) keep the state in ANALYSIS or the current state
		if (this.currentState === OrchestrationState.IDLE) {
			this.currentState = OrchestrationState.ANALYSIS
		}
	}

	getCurrentState(): OrchestrationState {
		return this.currentState
	}

	getActiveIntentId(): string | null {
		return this.currentIntentId
	}

	reset(): void {
		this.currentState = OrchestrationState.IDLE
		this.currentIntentId = null
	}

	private isMutationTool(toolName: string): boolean {
		return ["write_to_file", "edit_file", "apply_diff", "edit", "search_replace", "apply_patch"].includes(toolName)
	}
}

// Singleton for tracking session state
export const orchestrationStateMachine = new OrchestrationStateMachine()
