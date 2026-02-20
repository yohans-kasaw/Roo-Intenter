import * as fs from "fs/promises"
import * as path from "path"

/**
 * KnowledgeStore - Manages the shared knowledge base (CLAUDE.md / AGENT.md)
 * Implements the Shared Brain pattern for orchestration
 */
export class KnowledgeStore {
	private readonly workspaceRoot: string
	private readonly fileName: string

	constructor(workspaceRoot: string = process.cwd(), fileName: string = "CLAUDE.md") {
		this.workspaceRoot = workspaceRoot
		this.fileName = fileName
	}

	/**
	 * Append a lesson or decision to the knowledge base
	 */
	async appendKnowledge(type: "LESSON" | "DECISION", content: string): Promise<void> {
		const filePath = path.join(this.workspaceRoot, this.fileName)
		const timestamp = new Date().toISOString()

		const entry = `\n### [${timestamp}] ${type}\n${content}\n`

		try {
			// Check if file exists, if not create with header
			try {
				await fs.access(filePath)
			} catch {
				await fs.writeFile(
					filePath,
					`# Shared Knowledge Base\n\nThis file contains lessons learned and architectural decisions shared across agent sessions.\n`,
					"utf-8",
				)
			}

			await fs.appendFile(filePath, entry, "utf-8")
		} catch (error) {
			console.error(`Failed to update KnowledgeStore: ${error}`)
		}
	}

	/**
	 * Read the entire knowledge base
	 */
	async readAll(): Promise<string> {
		const filePath = path.join(this.workspaceRoot, this.fileName)
		try {
			return await fs.readFile(filePath, "utf-8")
		} catch {
			return ""
		}
	}
}
