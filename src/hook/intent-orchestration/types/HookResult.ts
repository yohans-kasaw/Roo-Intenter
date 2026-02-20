/**
 * Hook result types for pre/post tool interception
 */

export type HookAction = "allow" | "block" | "modify" | "inject"

export interface HookContext {
	tool_name: string
	tool_args: Record<string, any>
	intent_id?: string
	timestamp: string
	session_id?: string
	model_id?: string
}

export interface HookResult {
	action: HookAction
	shouldProceed: boolean
	modifiedArgs?: Record<string, any>
	contextToInject?: string
	error?: string
}

export type PreHookResult = HookResult

export interface PostHookResult extends HookResult {
	trace_record?: any // We use any here to avoid circular dependency with TraceTypes
}
