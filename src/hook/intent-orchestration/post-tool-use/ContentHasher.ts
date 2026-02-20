import { createHash } from "crypto"
import * as fs from "fs/promises"

/**
 * ContentHasher - Provides deterministic SHA-256 hashing for files and AST blocks
 * Used for intent-AST correlation and optimistic locking
 */
export class ContentHasher {
	/**
	 * Compute SHA-256 hash of a string content
	 */
	static hashString(content: string): string {
		return createHash("sha256").update(content).digest("hex")
	}

	/**
	 * Compute SHA-256 hash of a file on disk
	 */
	static async hashFile(filePath: string): Promise<string> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			return this.hashString(content)
		} catch (error) {
			return ""
		}
	}

	/**
	 * Compute hash of a specific line range in a file
	 */
	static async hashRange(filePath: string, startLine: number, endLine: number): Promise<string> {
		try {
			const content = await fs.readFile(filePath, "utf-8")
			const lines = content.split("\n")
			const rangeContent = lines.slice(startLine - 1, endLine).join("\n")
			return this.hashString(rangeContent)
		} catch (error) {
			return ""
		}
	}

	/**
	 * Verify if a file's current hash matches an expected hash
	 * Used for optimistic locking to prevent stale writes
	 */
	static async verifyHash(filePath: string, expectedHash: string): Promise<boolean> {
		const currentHash = await this.hashFile(filePath)
		return currentHash === expectedHash
	}
}
