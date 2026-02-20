/**
 * HookEngine - Core middleware/interceptor for intent orchestration
 * Implements the Pre-Hook/Post-Hook pattern for tool interception
 */

import type { ToolAction, ToolInterceptor } from "./types/ToolAction"
import type { HookContext, PreHookResult, PostHookResult } from "./types/HookResult"
import { IntentStore } from "./intent-store/IntentStore"

import { ContextInjector } from "./context-engineering/ContextInjector"
import { SpatialMap } from "./trace-store/SpatialMap"
import { KnowledgeStore } from "./knowledge-store/KnowledgeStore"
import { OrchestrationStateMachine } from "./state-machine/OrchestrationStateMachine"

export interface PreHook {
	name: string
	execute(context: HookContext, engine: HookEngine): Promise<PreHookResult>
}

export interface PostHook {
	name: string
	execute(context: HookContext, result: unknown, engine: HookEngine): Promise<PostHookResult>
}

export class HookEngine {
	private preHooks: Map<string, PreHook> = new Map()
	private postHooks: Map<string, PostHook> = new Map()
	private interceptors: Map<string, ToolInterceptor> = new Map()
	private activeIntentId: string | null = null
	private intentStore: IntentStore
	private contextInjector: ContextInjector
	public stateMachine = OrchestrationStateMachine

	constructor(workspaceRoot: string = process.cwd()) {
		this.intentStore = new IntentStore(workspaceRoot)
		this.contextInjector = new ContextInjector(
			this.intentStore,
			new KnowledgeStore(workspaceRoot),
			new SpatialMap(workspaceRoot),
		)
	}

	/**
	 * Register a pre-tool-use hook
	 */
	registerPreHook(hook: PreHook): void {
		this.preHooks.set(hook.name, hook)
	}

	/**
	 * Register a post-tool-use hook
	 */
	registerPostHook(hook: PostHook): void {
		this.postHooks.set(hook.name, hook)
	}

	/**
	 * Register a tool interceptor for specific tool names
	 */
	registerInterceptor(toolName: string, interceptor: ToolInterceptor): void {
		this.interceptors.set(toolName, interceptor)
	}

	/**
	 * Set the currently active intent
	 */
	setActiveIntent(intentId: string): void {
		this.activeIntentId = intentId
	}

	/**
	 * Get the currently active intent
	 */
	getActiveIntent(): string | null {
		return this.activeIntentId
	}

	getIntentStore(): IntentStore {
		return this.intentStore
	}

	getContextInjector(): ContextInjector {
		return this.contextInjector
	}

	/**
	 * Execute pre-tool-use hooks and interceptors
	 * This is the main entry point for tool interception
	 */
	async executePreHooks(
		tool: ToolAction,
		options?: { session_id?: string; model_id?: string },
	): Promise<PreHookResult> {
		const context: HookContext = {
			tool_name: tool.name,
			tool_args: tool.args,
			intent_id: this.activeIntentId || undefined,
			timestamp: new Date().toISOString(),
			session_id: options?.session_id,
			model_id: options?.model_id,
		}

		try {
			// Execute registered interceptors first
			const interceptor = this.interceptors.get(tool.name)
			if (interceptor) {
				const result = await interceptor(tool, context)
				if (!result.shouldProceed) {
					return result as PreHookResult
				}
			}

			// Execute all registered pre-hooks
			for (const [, hook] of this.preHooks) {
				const result = await hook.execute(context, this)
				if (!result.shouldProceed) {
					return result
				}
			}
		} catch (error) {
			// Error boundary
			console.error(`Error in PreHook execution:`, error)
			return {
				action: "block",
				shouldProceed: false,
				error: error instanceof Error ? error.message : String(error),
			}
		}

		return {
			action: "allow",
			shouldProceed: true,
		}
	}

	/**
	 * Execute post-tool-use hooks
	 */
	async executePostHooks(
		tool: ToolAction,
		result: unknown,
		options?: { session_id?: string; model_id?: string },
	): Promise<PostHookResult> {
		const context: HookContext = {
			tool_name: tool.name,
			tool_args: tool.args,
			intent_id: this.activeIntentId || undefined,
			timestamp: new Date().toISOString(),
			session_id: options?.session_id,
			model_id: options?.model_id,
		}

		try {
			for (const [, hook] of this.postHooks) {
				const hookResult = await hook.execute(context, result, this)
				if (!hookResult.shouldProceed) {
					return hookResult
				}
			}
		} catch (error) {
			// Fail-safe error boundary: Post hooks should not crash the host
			console.error(`Error in PostHook execution:`, error)
		}

		return {
			action: "allow",
			shouldProceed: true,
		}
	}
}

// Singleton instance
export const hookEngine = new HookEngine()
