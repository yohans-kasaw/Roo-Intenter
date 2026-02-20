/**
 * ASTSemanticAnalyzer
 * Parses old and new file content to heuristically determine the true
 * mutation class (`AST_REFACTOR`, `FEATURE_ADDITION`, `BUG_FIX`, etc.)
 */

import { MutationClass } from "../types/TraceTypes"

export class ASTSemanticAnalyzer {
	/**
	 * Compare two strings of source code and classify the mutation.
	 * This is a simulated AST analysis using regex heuristics.
	 */
	static analyze(oldContent: string | null, newContent: string, filePath: string): MutationClass {
		// 1. Path-based heuristics
		if (filePath.includes("/test/") || filePath.includes(".spec.") || filePath.includes(".test.")) {
			return "BUG_FIX"
		}
		if (filePath.endsWith(".md") || filePath.endsWith(".txt") || filePath.includes("docs/")) {
			return "DOCS_UPDATE"
		}

		// 2. If it's a completely new file
		if (!oldContent) {
			return "INTENT_EVOLUTION"
		}

		// 3. Structural comparisons
		const oldLines = oldContent.split("\n")
		const newLines = newContent.split("\n")

		const oldFunctionCount = this.countMatches(
			oldContent,
			/function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>|class\s+\w+/g,
		)
		const newFunctionCount = this.countMatches(
			newContent,
			/function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>|class\s+\w+/g,
		)

		const oldImportCount = this.countMatches(oldContent, /import\s+.*from/g)
		const newImportCount = this.countMatches(newContent, /import\s+.*from/g)

		const lineDiff = Math.abs(oldLines.length - newLines.length)

		// If functions were renamed or heavily reorganized but count is same -> Refactor
		if (oldFunctionCount === newFunctionCount && lineDiff < 10) {
			// Check if they just added comments or reformatted
			return "AST_REFACTOR"
		}

		// If new functions/classes were added -> Feature Addition / Intent Evolution
		if (newFunctionCount > oldFunctionCount || newImportCount > oldImportCount) {
			return "INTENT_EVOLUTION"
		}

		// If lines were removed or very small internal logic changed -> Bug Fix
		if (lineDiff < 5) {
			return "BUG_FIX"
		}

		// Default fallback
		return "AST_REFACTOR"
	}

	private static countMatches(text: string, regex: RegExp): number {
		const matches = text.match(regex)
		return matches ? matches.length : 0
	}

	/**
	 * Extract exact line range that was modified.
	 * Returns the first and last line number that differ.
	 */
	static getModifiedRange(oldContent: string, newContent: string): { start: number; end: number } {
		const oldLines = oldContent.split("\n")
		const newLines = newContent.split("\n")

		let start = 0
		while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
			start++
		}

		let endOld = oldLines.length - 1
		let endNew = newLines.length - 1
		while (endOld > start && endNew > start && oldLines[endOld] === newLines[endNew]) {
			endOld--
			endNew--
		}

		return {
			start: start + 1, // 1-indexed
			end: endNew + 1,
		}
	}
}
