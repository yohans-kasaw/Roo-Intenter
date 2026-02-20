/**
 * PostToolUseHook - Post-tool-use interceptor implementation
 * Handles trace recording, spatial map updates, and intent-AST correlation
 */

import { v4 as uuidv4 } from "uuid"
import { exec } from "child_process"
import { promisify } from "util"
import type { PostHook } from "../HookEngine"
import type { HookContext, PostHookResult } from "../types/HookResult"
import type {
	TraceRecord,
	MutationClass,
	TrackedFile,
	Conversation,
	ContentRange,
	SpatialMap,
	TraceLedger,
} from "../types/TraceTypes"
import { IntentStore } from "../intent-store/IntentStore"
import { ContentHasher } from "./ContentHasher"

const execAsync = promisify(exec)

export interface PostToolUseConfig {
	intentStore: IntentStore
	traceLedger: TraceLedger
	spatialMap: SpatialMap
}

export class PostToolUseHook implements PostHook {
	name = "PostToolUseHook"
	private config: PostToolUseConfig

	constructor(config: PostToolUseConfig) {
		this.config = config
	}

	async execute(context: HookContext, result: unknown): Promise<PostHookResult> {
		const { tool_name, tool_args, intent_id, timestamp, session_id, model_id } = context

		// Only process if we have an active intent and it's a mutation tool
		if (!intent_id || !this.isMutationTool(tool_name)) {
			return { action: "allow", shouldProceed: true }
		}

		try {
			const filePath = this.extractFilePath(tool_name, tool_args)
			if (!filePath) return { action: "allow", shouldProceed: true }

			// 1. Get VCS info
			const revisionId = await this.getCurrentRevision()

			// 2. Compute content hash for the modified block
			// For write_to_file, it's the whole file. For edits, ideally it's the range.
			const startLine = (tool_args.start_line as number) || 1
			const endLine = (tool_args.end_line as number) || (await this.getFileLineCount(filePath))
			const contentHash = await ContentHasher.hashRange(filePath, startLine, endLine)

			// 3. Classify mutation
			const mutationClass = this.classifyMutation(tool_name, tool_args)

			// 4. Construct Trace Record per schema
			const range: ContentRange = {
				start_line: startLine,
				end_line: endLine,
				content_hash: `sha256:${contentHash}`,
			}

			const conversation: Conversation = {
				url: session_id || "unknown_session",
				contributor: {
					entity_type: "AI",
					model_identifier: model_id || "unknown_model",
				},
				ranges: [range],
				related: [
					{
						type: "specification",
						value: intent_id,
					},
				],
				mutation_class: mutationClass,
			}

			const trackedFile: TrackedFile = {
				relative_path: filePath,
				conversations: [conversation],
			}

			const record: TraceRecord = {
				id: uuidv4(),
				timestamp,
				vcs: { revision_id: revisionId },
				files: [trackedFile],
			}

			// 5. Update Ledger and Spatial Map
			await this.config.traceLedger.add(record)
			await this.config.spatialMap.add({
				file_path: filePath,
				intent_id,
				operation_type: "modify",
				timestamp,
				line_range: { start: startLine, end: endLine },
				content_hash: contentHash,
			})

			return {
				action: "allow",
				shouldProceed: true,
			}
		} catch (error) {
			console.error(`PostToolUseHook execution failed: ${error}`)
			// Fail-safe: don't block the agent if tracing fails
			return { action: "allow", shouldProceed: true }
		}
	}

	private isMutationTool(toolName: string): boolean {
		const mutationTools = ["write_to_file", "edit_file", "apply_diff", "edit", "search_replace", "apply_patch"]
		return mutationTools.includes(toolName)
	}

	private extractFilePath(toolName: string, toolArgs: Record<string, any>): string | null {
		return toolArgs.path || toolArgs.file_path || toolArgs.filePath || null
	}

	private async getCurrentRevision(): Promise<string> {
		try {
			const { stdout } = await execAsync("git rev-parse HEAD")
			return stdout.trim()
		} catch {
			return "no-git-revision"
		}
	}

	private async getFileLineCount(filePath: string): Promise<number> {
		try {
			const content = await ContentHasher.hashFile(filePath) // Just to check existence/readability
			// In a real implementation, we'd count lines. For now, assume a reasonable default or 1000.
			return 1000
		} catch {
			return 1
		}
	}

	private classifyMutation(toolName: string, toolArgs: Record<string, any>): MutationClass {
		if (toolName === "write_to_file") return "INTENT_EVOLUTION"
		if (toolName === "edit" || toolName === "search_replace" || toolName === "apply_diff") return "AST_REFACTOR"
		if (toolArgs.path?.includes("docs/") || toolArgs.path?.endsWith(".md")) return "DOCS_UPDATE"
		return "INTENT_EVOLUTION"
	}
}
