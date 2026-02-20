import * as fs from "fs/promises"
import * as path from "path"
import { SpatialMapEntry, SpatialMap as ISpatialMap } from "../types/TraceTypes"
import { OrchestrationPaths } from "../intent-store/OrchestrationPaths"

/**
 * SpatialMap - Maps high-level business intents to physical files and line ranges
 * Used to maintain a persistent map of "who owns what" in the codebase
 */
export class SpatialMap implements ISpatialMap {
	private entries: SpatialMapEntry[] = []
	private readonly workspaceRoot: string

	constructor(workspaceRoot: string = process.cwd()) {
		this.workspaceRoot = workspaceRoot
	}

	/**
	 * Add an entry to the spatial map and persist to disk
	 */
	async add(entry: SpatialMapEntry): Promise<void> {
		this.entries.push(entry)
		await this.save()
	}

	/**
	 * Load the spatial map from disk
	 */
	async load(): Promise<void> {
		const filePath = path.join(this.workspaceRoot, OrchestrationPaths.spatialMap())
		try {
			const content = await fs.readFile(filePath, "utf-8")
			this.entries = JSON.parse(content)
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
				console.error(`Failed to load SpatialMap: ${error}`)
			}
			this.entries = []
		}
	}

	/**
	 * Save the spatial map to disk
	 */
	private async save(): Promise<void> {
		const filePath = path.join(this.workspaceRoot, OrchestrationPaths.spatialMap())
		try {
			await fs.mkdir(path.dirname(filePath), { recursive: true })
			await fs.writeFile(filePath, JSON.stringify(this.entries, null, 2), "utf-8")
		} catch (error) {
			console.error(`Failed to save SpatialMap: ${error}`)
		}
	}

	/**
	 * Get all entries
	 */
	getAll(): SpatialMapEntry[] {
		return [...this.entries]
	}

	/**
	 * Get entries for a specific file
	 */
	getByFile(filePath: string): SpatialMapEntry[] {
		return this.entries.filter((entry) => entry.file_path === filePath)
	}

	/**
	 * Get entries for a specific intent
	 */
	getByIntent(intentId: string): SpatialMapEntry[] {
		return this.entries.filter((entry) => entry.intent_id === intentId)
	}
}
