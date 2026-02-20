import * as fs from "fs/promises"
import * as path from "path"
import { SpatialMapEntry } from "../types/TraceTypes"
import { OrchestrationPaths } from "../intent-store/OrchestrationPaths"

/**
 * MarkdownMapWriter - Synchronizes the spatial map to a human-readable Markdown file
 * Provides visibility into intent-code mapping for users
 */
export class MarkdownMapWriter {
	private readonly workspaceRoot: string

	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = workspaceRoot
	}

	/**
	 * Update the intent_map.md file based on spatial map entries
	 */
	async update(entries: SpatialMapEntry[]): Promise<void> {
		const filePath = path.join(this.workspaceRoot, OrchestrationPaths.intentMap())

		let content = "# Intent Spatial Map\n\n"
		content += "This file maps high-level business intents to physical files and AST nodes. Managed by machine.\n\n"

		// Group by Intent ID
		const groupedByIntent = entries.reduce(
			(acc, entry) => {
				if (!acc[entry.intent_id]) {
					acc[entry.intent_id] = []
				}
				acc[entry.intent_id].push(entry)
				return acc
			},
			{} as Record<string, SpatialMapEntry[]>,
		)

		for (const [intentId, intentEntries] of Object.entries(groupedByIntent)) {
			content += `## Intent: ${intentId}\n\n`
			content += "| File Path | Operation | Lines | Content Hash | Timestamp |\n"
			content += "|-----------|-----------|-------|--------------|-----------|\n"

			for (const entry of intentEntries) {
				const range = entry.line_range ? `${entry.line_range.start}-${entry.line_range.end}` : "Full File"
				const hash = entry.content_hash ? `\`${entry.content_hash.substring(0, 8)}\`` : "N/A"
				content += `| ${entry.file_path} | ${entry.operation_type} | ${range} | ${hash} | ${entry.timestamp} |\n`
			}
			content += "\n"
		}

		try {
			await fs.mkdir(path.dirname(filePath), { recursive: true })
			await fs.writeFile(filePath, content, "utf-8")
		} catch (error) {
			console.error(`Failed to write intent_map.md: ${error}`)
		}
	}
}
