import * as ts from "typescript"
import { MutationClass } from "../types/TraceTypes"

/**
 * Interface representing the counts of different structural nodes in the AST.
 */
interface ASTStructure {
	functions: number
	classes: number
	interfaces: number
	variables: number
	imports: number
}

export class ASTSemanticAnalyzer {
	/**
	 * Compare two strings of source code and classify the mutation
	 * using the TypeScript Compiler API.
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

		// 3. True AST Parsing & Structural comparisons
		const oldAST = this.parseAST(oldContent, filePath)
		const newAST = this.parseAST(newContent, filePath)

		const oldStructure = this.analyzeStructure(oldAST)
		const newStructure = this.analyzeStructure(newAST)

		// Check for major additions (new functions, classes, interfaces, or imports)
		if (
			newStructure.functions > oldStructure.functions ||
			newStructure.classes > oldStructure.classes ||
			newStructure.interfaces > oldStructure.interfaces ||
			newStructure.imports > oldStructure.imports ||
			newStructure.variables > oldStructure.variables
		) {
			return "INTENT_EVOLUTION"
		}

		// Calculate exact lines diff
		const oldLines = oldContent.split("\n").length
		const newLines = newContent.split("\n").length
		const lineDiff = Math.abs(oldLines - newLines)

		// If nothing structural was added, but functions/classes were removed or reorganized heavily
		if (
			newStructure.functions === oldStructure.functions &&
			newStructure.classes === oldStructure.classes &&
			lineDiff < 10
		) {
			return "AST_REFACTOR"
		}

		// If lines were removed or very small internal logic changed
		if (lineDiff < 5) {
			return "BUG_FIX"
		}

		return "AST_REFACTOR"
	}

	/**
	 * Parse content into a TypeScript SourceFile.
	 */
	private static parseAST(content: string, filePath: string): ts.SourceFile {
		const isTsxOrJsx = filePath.endsWith(".tsx") || filePath.endsWith(".jsx")
		const scriptKind = isTsxOrJsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS

		return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind)
	}

	/**
	 * Traverse the AST to count major structural elements.
	 */
	private static analyzeStructure(node: ts.Node): ASTStructure {
		const structure: ASTStructure = {
			functions: 0,
			classes: 0,
			interfaces: 0,
			variables: 0,
			imports: 0,
		}

		const visit = (child: ts.Node) => {
			if (ts.isFunctionDeclaration(child) || ts.isMethodDeclaration(child) || ts.isArrowFunction(child)) {
				structure.functions++
			} else if (ts.isClassDeclaration(child)) {
				structure.classes++
			} else if (ts.isInterfaceDeclaration(child) || ts.isTypeAliasDeclaration(child)) {
				structure.interfaces++
			} else if (ts.isVariableDeclaration(child)) {
				structure.variables++
			} else if (ts.isImportDeclaration(child)) {
				structure.imports++
			}
			ts.forEachChild(child, visit)
		}

		visit(node)
		return structure
	}

	/**
	 * Extract exact line range that was modified.
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
