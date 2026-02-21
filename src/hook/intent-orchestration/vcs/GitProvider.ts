import { exec } from "child_process"
import { promisify } from "util"

const execAsync = promisify(exec)

export interface GitMetadata {
	revision_id: string
	branch: string
	author: string
	is_dirty: boolean
}

/**
 * GitProvider
 * Fetches accurate VCS metadata to attach to the agent_trace.jsonl ledger.
 */
export class GitProvider {
	private workspaceRoot: string

	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = workspaceRoot
	}

	async getMetadata(): Promise<GitMetadata> {
		try {
			const [rev, branch, author, status] = await Promise.all([
				this.execute("git rev-parse HEAD"),
				this.execute("git rev-parse --abbrev-ref HEAD"),
				this.execute("git config user.name").catch(() => "Unknown AI User"),
				this.execute("git status --porcelain"),
			])

			return {
				revision_id: rev.trim() || "unknown_revision",
				branch: branch.trim() || "unknown_branch",
				author: author.trim() || "AI Orchestrator",
				is_dirty: status.trim().length > 0,
			}
		} catch (error) {
			// Fallback if not a git repository
			return {
				revision_id: "no_vcs_found",
				branch: "none",
				author: "AI",
				is_dirty: false,
			}
		}
	}

	private async execute(command: string): Promise<string> {
		const { stdout } = await execAsync(command, { cwd: this.workspaceRoot })
		return stdout
	}
}
