/**
 * PostToolUseHook - Post-tool-use interceptor implementation
 * Handles trace recording, spatial map updates, and intent-AST correlation
 */

import { v4 as uuidv4 } from "uuid"
import * as fs from "fs/promises"
import type { PostHook, HookEngine } from "../HookEngine"
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
import { ASTSemanticAnalyzer } from "../ast-analysis/ASTSemanticAnalyzer"
import { GitProvider } from "../vcs/GitProvider"

export interface PostToolUseConfig {
	intentStore: IntentStore
	traceLedger: TraceLedger
	spatialMap: SpatialMap
}

export class PostToolUseHook implements PostHook {
	name = "PostToolUseHook"
	private config: PostToolUseConfig
	private gitProvider: GitProvider

	constructor(config: PostToolUseConfig) {
		this.config = config
		this.gitProvider = new GitProvider()
	}

	async execute(context: HookContext, result: unknown, engine: HookEngine): Promise<PostHookResult> {
		const { tool_name, tool_args, intent_id, timestamp, session_id, model_id } = context

		// Only process if we have an active intent and it's a mutation tool
		if (!intent_id || !this.isMutationTool(tool_name)) {
			return { action: "allow", shouldProceed: true }
		}

		try {
			const filePath = this.extractFilePath(tool_name, tool_args)
			if (!filePath) return { action: "allow", shouldProceed: true }

			// 1. Get VCS info accurately via GitProvider
			const gitMeta = await this.gitProvider.getMetadata()

			// 2. Load file contents for semantic diffing
			let newContent = ""
			let oldContent: string | null = null
			try {
				newContent = await fs.readFile(filePath, "utf-8")
				// Simulated: in a real environment we'd pull the old state before the tool execution
				oldContent = newContent // (Mock fallback)
			} catch (e) {
				// File didn't exist or couldn't be read
			}

			// 3. Compute semantic mutation class using AST Analyzer
			const mutationClass = ASTSemanticAnalyzer.analyze(oldContent, newContent, filePath)

			// 4. Compute content hash for the modified block
			let startLine = (tool_args.start_line as number) || 1
			let endLine = (tool_args.end_line as number) || undefined

			if (!endLine) {
				endLine = newContent.split("\n").length || 1
			}

			const contentHash = await ContentHasher.hashRange(filePath, startLine, endLine)

			// 5. Construct Trace Record per schema
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
				vcs: { revision_id: gitMeta.revision_id },
				files: [trackedFile],
			}

			// 6. Update Ledger and Spatial Map
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
		return "removed-legacy" // Handled by GitProvider now
	}

	private async getFileLineCount(filePath: string): Promise<number> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			return content.split("\n").length
		} catch {
			return 1
		}
	}

	private classifyMutation(toolName: string, toolArgs: Record<string, any>, filePath: string): MutationClass {
		if (filePath.includes("test") || filePath.includes("spec")) return "BUG_FIX"
		if (filePath.includes("docs/") || filePath.endsWith(".md")) return "DOCS_UPDATE"
		if (toolName === "edit" || toolName === "search_replace" || toolName === "apply_diff") return "AST_REFACTOR"
		return "INTENT_EVOLUTION"
	}
}
