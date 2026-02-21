/**
 * ConstraintValidator
 * Translates natural language constraints into explicit, blockable rules.
 */

export class ConstraintValidator {
	/**
	 * Evaluates tool arguments against a list of text constraints.
	 * E.g., constraint: "Must not modify tests"
	 * toolArgs: { path: "src/test/HookEngine.test.ts" } -> Blocks.
	 */
	static validate(
		toolName: string,
		toolArgs: Record<string, any>,
		constraints: string[],
	): { valid: boolean; reason?: string } {
		const filePath = toolArgs.path || toolArgs.file_path || toolArgs.filePath || ""

		for (const constraint of constraints) {
			const lowerConstraint = constraint.toLowerCase()

			// Rule 1: Anti-Test Modification
			if (lowerConstraint.includes("not modify test") || lowerConstraint.includes("do not edit tests")) {
				if (filePath.includes("test") || filePath.includes("spec")) {
					return {
						valid: false,
						reason: `Constraint Violation: '${constraint}'. Attempted to modify ${filePath}`,
					}
				}
			}

			// Rule 2: Anti-Config Modification
			if (lowerConstraint.includes("not modify config") || lowerConstraint.includes("no package.json")) {
				if (
					filePath.endsWith("package.json") ||
					filePath.endsWith("tsconfig.json") ||
					filePath.endsWith("webpack.config.js")
				) {
					return {
						valid: false,
						reason: `Constraint Violation: '${constraint}'. Attempted to modify configuration file ${filePath}`,
					}
				}
			}

			// Rule 3: Only specific directories (e.g., "Only modify src/ui")
			if (lowerConstraint.startsWith("only modify") || lowerConstraint.startsWith("only edit")) {
				const match = lowerConstraint.match(/only (?:modify|edit)\s+([\w\/\.\-]+)/)
				if (match && match[1]) {
					const allowedDir = match[1]
					if (filePath && !filePath.includes(allowedDir)) {
						return {
							valid: false,
							reason: `Constraint Violation: '${constraint}'. File ${filePath} is outside allowed directory ${allowedDir}`,
						}
					}
				}
			}

			// Rule 4: Ban specific tools
			if (lowerConstraint.includes("no shell") || lowerConstraint.includes("no execute_command")) {
				if (toolName === "execute_command") {
					return {
						valid: false,
						reason: `Constraint Violation: '${constraint}'. Tool ${toolName} is forbidden.`,
					}
				}
			}
		}

		return { valid: true }
	}
}
