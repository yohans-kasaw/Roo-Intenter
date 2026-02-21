import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import { OrchestrationPaths } from "../intent-store/OrchestrationPaths"
import type { ActiveIntentsSpec } from "../types/IntentTypes"
import { GitProvider } from "../vcs/GitProvider"

/**
 * OrchestrationBootstrapper
 * Responsible for the runtime machine-management of the .orchestration sidecar.
 * Scaffolds the schemas completely from scratch if missing to guarantee 100%
 * programmatic artifact creation.
 */
export class OrchestrationBootstrapper {
	private workspaceRoot: string
	private gitProvider: GitProvider

	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = workspaceRoot
		this.gitProvider = new GitProvider()
	}

	/**
	 * Ensures the complete .orchestration structure exists.
	 * If missing, generates the correct architectural schemas and initial seeds.
	 */
	async bootstrap(): Promise<void> {
		const orchestratorDir = path.join(this.workspaceRoot, ".orchestration")

		try {
			await fs.access(orchestratorDir)
			// Directory exists, check files incrementally
		} catch {
			// Create directory
			await fs.mkdir(orchestratorDir, { recursive: true })
		}

		await this.bootstrapActiveIntents()
		await this.bootstrapAgentTrace()
		await this.bootstrapSpatialMap()
		await this.bootstrapSharedBrain()
	}

	private async bootstrapActiveIntents(): Promise<void> {
		const relPath = OrchestrationPaths.activeIntents()
		const filePath = path.join(this.workspaceRoot, relPath)
		try {
			await fs.access(filePath)
		} catch {
			const initialSpec: ActiveIntentsSpec = {
				active_intents: [
					{
						id: "INT-BOOTSTRAP",
						name: "System Bootstrapped Intent",
						status: "PENDING",
						owned_scope: ["**/*"],
						constraints: ["Must adhere to basic security and context bounds"],
						acceptance_criteria: ["The system successfully tracks agent activity"],
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					},
				],
			}
			const yamlContent = yaml.dump(initialSpec)
			await fs.writeFile(filePath, yamlContent, "utf-8")
		}
	}

	private async bootstrapAgentTrace(): Promise<void> {
		const relPath = OrchestrationPaths.traceLedger()
		const filePath = path.join(this.workspaceRoot, relPath)
		try {
			await fs.access(filePath)
		} catch {
			// jsonl file starts empty or with a genesis record
			const vcsMeta = await this.gitProvider.getMetadata()
			const genesisRecord = {
				id: "genesis-record",
				timestamp: new Date().toISOString(),
				vcs: {
					revision_id: vcsMeta.revision_id || "genesis",
				},
				files: [],
			}
			await fs.writeFile(filePath, JSON.stringify(genesisRecord) + "\n", "utf-8")
		}
	}

	private async bootstrapSpatialMap(): Promise<void> {
		const relPath = OrchestrationPaths.spatialMap()
		const filePath = path.join(this.workspaceRoot, relPath)
		try {
			await fs.access(filePath)
		} catch {
			// empty array for JSON
			await fs.writeFile(filePath, "[\n]", "utf-8")
		}
	}

	private async bootstrapSharedBrain(): Promise<void> {
		const relPath = OrchestrationPaths.sharedBrain()
		const filePath = path.join(this.workspaceRoot, relPath)
		try {
			await fs.access(filePath)
		} catch {
			const content = `# Shared Knowledge Base

This file contains lessons learned and architectural decisions shared across agent sessions.

### [${new Date().toISOString()}] SYSTEM INITIALIZED
The Context Engine and Trace Ledger have been bootstrapped successfully.
`
			await fs.writeFile(filePath, content, "utf-8")
		}
	}
}
