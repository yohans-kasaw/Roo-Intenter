/**
 * PreToolUseHook - Pre-tool-use interceptor implementation
 * Handles intent validation, scope enforcement, and context injection
 * Aligned with the research documentation
 */

import * as fs from "fs/promises"
import type { PreHook, HookEngine } from "../HookEngine"
import type { HookContext, PreHookResult } from "../types/HookResult"
import type { IntentDefinition } from "../types/IntentTypes"
import { IntentStore } from "../intent-store/IntentStore"
import { ValidationError } from "../errors/ValidationError"
import { ScopeViolationError } from "../errors/ScopeViolationError"
import { IntentNotSelectedError } from "../errors/IntentNotSelectedError"
import { globMatch } from "../utils/globMatch"
import { ConstraintValidator } from "../validation/ConstraintValidator"
import { orchestrationStateMachine } from "../state-machine/OrchestrationStateMachine"

export interface PreToolUseConfig {
	intentStore: IntentStore
	requireIntentForTools: string[]
}

export class PreToolUseHook implements PreHook {
	name = "PreToolUseHook"
	private config: PreToolUseConfig

	constructor(config: PreToolUseConfig) {
		this.config = config
	}

	async execute(context: HookContext, engine: HookEngine): Promise<PreHookResult> {
		const { tool_name, tool_args, intent_id } = context

		// Step 0: State Machine Enforcement
		try {
			orchestrationStateMachine.transition(tool_name, tool_args || {})
		} catch (error) {
			return {
				action: "block",
				shouldProceed: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}

		// Step 1: Check if intent is selected for tools that require it
		if (this.requiresIntent(tool_name) && !intent_id) {
			return {
				action: "block",
				shouldProceed: false,
				error: new IntentNotSelectedError(undefined, tool_name).message,
			}
		}

		// Step 2: Validate intent exists and is active
		if (intent_id) {
			const intent = this.config.intentStore.getIntentById(intent_id)
			if (!intent) {
				return {
					action: "block",
					shouldProceed: false,
					error: new ValidationError(`Intent '${intent_id}' not found`).message,
				}
			}

			if (intent.status !== "IN_PROGRESS") {
				return {
					action: "block",
					shouldProceed: false,
					error: new ValidationError(`Intent '${intent_id}' is not IN_PROGRESS (status: ${intent.status})`)
						.message,
				}
			}

			// Step 3: Enforce natural language constraints using dynamic validation
			if (intent.constraints && intent.constraints.length > 0) {
				const constraintCheck = ConstraintValidator.validate(tool_name, tool_args || {}, intent.constraints)
				if (!constraintCheck.valid) {
					return {
						action: "block",
						shouldProceed: false,
						error: constraintCheck.reason,
					}
				}
			}

			// Step 4: Enforce scope constraints
			const scopeCheck = this.checkScope(tool_name, tool_args, intent)
			if (!scopeCheck.allowed) {
				return {
					action: "block",
					shouldProceed: false,
					error: scopeCheck.error,
				}
			}

			// Step 5: Inject intent context for the first mutation tool
			if (this.isMutationTool(tool_name)) {
				// 5a. Stash old content for AST diffing in PostToolUseHook
				const filePath = this.extractFilePath(tool_name, tool_args || {})
				if (filePath) {
					try {
						const oldContent = await fs.readFile(filePath, "utf-8")
						engine.setOldContent(filePath, oldContent)
					} catch (e) {
						// File doesn't exist yet, that's fine for new files
						engine.setOldContent(filePath, "")
					}
				}

				// 5b. Inject intent context
				const selectedIntent = this.config.intentStore.getSelectedIntent()
				if (selectedIntent && !selectedIntent.context_injected) {
					this.config.intentStore.markContextInjected()

					// Get dynamic context from injector
					const injector = engine.getContextInjector()
					const richContext = await injector.buildDynamicPrompt(intent_id)

					return {
						action: "inject",
						shouldProceed: true,
						contextToInject: richContext,
					}
				}
			}
		}

		return {
			action: "allow",
			shouldProceed: true,
		}
	}

	/**
	 * Check if tool requires an active intent
	 */
	private requiresIntent(toolName: string): boolean {
		return this.config.requireIntentForTools.includes(toolName)
	}

	/**
	 * Check if tool is a mutation tool (modifies files)
	 */
	private isMutationTool(toolName: string): boolean {
		const mutationTools = ["write_to_file", "edit_file", "apply_diff", "edit", "search_replace", "apply_patch"]
		return mutationTools.includes(toolName)
	}

	/**
	 * Check if the tool operation is within the intent scope
	 */
	private checkScope(
		toolName: string,
		toolArgs: Record<string, any>,
		intent: IntentDefinition,
	): { allowed: boolean; error?: string } {
		// Extract file path from tool args
		const filePath = this.extractFilePath(toolName, toolArgs)
		if (!filePath) {
			return { allowed: true }
		}

		// Check owned_scope (include patterns)
		for (const pattern of intent.owned_scope) {
			if (globMatch(filePath, pattern)) {
				return { allowed: true }
			}
		}

		// Not in any include pattern
		return {
			allowed: false,
			error: new ScopeViolationError(
				`File '${filePath}' is outside the intent scope`,
				intent.id || "unknown",
				filePath,
				toolName,
			).message,
		}
	}

	/**
	 * Extract file path from tool arguments
	 */
	private extractFilePath(toolName: string, toolArgs: Record<string, any>): string | null {
		const pathFields = ["path", "file_path", "filePath"]
		for (const field of pathFields) {
			if (toolArgs[field] && typeof toolArgs[field] === "string") {
				return toolArgs[field] as string
			}
		}
		return null
	}
}
