# Intent Orchestration Implementation Report

## 1. Complete Implementation Architecture & Schemas

### Overview

The intent orchestration layer is a strictly structured sidecar (`.orchestration/`) operating alongside the codebase. It implements the "Checkout -> Act" state machine using a middleware Hook Engine, which prevents Context Rot and unguided modifications by forcing an explicit intent selection step before code is generated.

### Schemas

The following types accurately reflect the TypeScript implementation in `src/hook/intent-orchestration/types/`.

#### Active Intents Specification (`active_intents.yaml`)

This is the source of truth for all current and completed tasks.

```typescript
export interface ActiveIntentsSpec {
	active_intents: IntentDefinition[]
}

export interface IntentDefinition {
	id: string // Unique identifier, e.g., "INT-001"
	name: string // Human-readable task name
	status: "IN_PROGRESS" | "COMPLETED" | "PENDING"
	owned_scope: string[] // Glob patterns defining allowed files
	constraints: string[] // Textual rules the agent must follow
	acceptance_criteria: string[] // Requirements for completion
	created_at?: string // ISO timestamp
	updated_at?: string // ISO timestamp
}
```

**Architectural Justification:** We use YAML because it is highly human-readable, easily parsed by LLMs, and plays nicely with Git diffs.

#### Agent Trace Ledger (`agent_trace.jsonl`)

The immutable record of what the agent did.

```typescript
export interface TraceRecord {
	id: string // UUID v4
	timestamp: string // ISO timestamp
	vcs: {
		revision_id: string // Commit hash before modification
	}
	files: TrackedFile[] // Files mutated in this trace event
}

export interface TrackedFile {
	relative_path: string
	conversations: Conversation[]
}

export interface Conversation {
	url: string // Session or task ID
	contributor: {
		entity_type: "AI" | "Human"
		model_identifier?: string // e.g., "claude-3-sonnet"
	}
	ranges: {
		start_line: number
		end_line: number
		content_hash: string // SHA-256 of the new content range
	}[]
	related: {
		type: "specification" | "intent" | "issue"
		value: string // Maps back to IntentDefinition.id
	}[]
	mutation_class?: "AST_REFACTOR" | "INTENT_EVOLUTION" | "DOCS_UPDATE" | "BUG_FIX"
}
```

**Architectural Justification:** JSONL (JSON Lines) is append-only, reducing merge conflicts for concurrent AI sessions. The SHA-256 content hashing acts as an AI-Native Git layer, verifying the exact snippet that was modified by a specific intent.

#### Spatial Map (`spatial_map.json`)

Maintains a mapping of intents to specific files for quick context lookup.

```typescript
export interface SpatialMapEntry {
	file_path: string
	intent_id: string
	operation_type: "read" | "write" | "modify"
	timestamp: string
	line_range?: { start: number; end: number }
	content_hash?: string
}
```

#### Shared Brain (`CLAUDE.md`)

Persists global knowledge, architectural decisions, and agent lessons learned across multiple sessions.

### Internal Consistency

All schemas match the actual code types in `src/hook/intent-orchestration/types/`. The `TraceLedgerWriter` consumes these types precisely as defined.

---

## 2. Agent Flow & Hook System Breakdown

### Step-by-Step Flow

1. **User Prompt:** The user asks the agent to implement a feature.
2. **Analysis:** The agent reads the system prompt rules (`src/core/prompts/sections/rules.ts`) and recognizes the "Checkout -> Act" mandate.
3. **Intent Selection (The Handshake):**
    - The agent calls the `select_active_intent` tool with a target `intent_id`.
    - `HookEngine` intercepts this specific tool.
    - It validates the `intent_id` against `active_intents.yaml`.
    - If valid, the `HookEngine` returns a curated XML `<intent_context>` block directly as the tool result. It sets `context_injected = true`.
4. **Code Generation:**
    - The agent attempts to call a mutating tool (e.g., `edit_file`).
    - **Pre-Hook:** `PreToolUseHook` checks if an intent is active. It also validates the target file path against `owned_scope`.
    - If outside scope, returns a structured `ScopeViolationError` blocking the action.
    - If valid, tool execution proceeds normally.
5. **Post-Hook Tracing:**
    - `PostToolUseHook` intercepts the result.
    - It computes the SHA-256 hash of the modified content via `ContentHasher.ts`.
    - It generates a `TraceRecord` entry mapping the `intent_id` to the file modification.
    - It appends the record to `agent_trace.jsonl` and updates `spatial_map.json`.

### Diagram of the Hook Pipeline

```
Agent Action -> [ Pre-Hooks ] -> Target Tool -> [ Post-Hooks ] -> Agent Receives Result
                      |                               |
                Verify Intent ID                Hash Content
                Enforce Scope                   Classify Mutation
                Inject Context                  Write to agent_trace.jsonl
```

### Failure Modes & Graceful Degradation

- If `.orchestration` config is missing, the system gracefully bypasses enforcement rather than crashing the extension host.
- If a Pre-Hook fails validation (e.g., scope violation), it returns `{ action: "block", error: "..." }`. The host surfaces this as a natural tool error to the LLM, prompting a self-correction.
- If a Post-Hook fails (e.g., disk full when writing trace), it logs the error but returns `{ action: "allow" }` to prevent blocking the user's actual code changes.

---

## 3. Achievement Summary & Reflective Analysis

### Honest Inventory

**Fully Implemented & Working:**

- The Hook Engine Middleware Pattern (`HookEngine.ts`, Pre/Post Hooks).
- Intent Store loading, parsing, and context injection (`IntentStore.ts`).
- Semantic Ledger writing via append-only JSONL (`TraceLedger.ts`).
- Content hashing for precise line modifications (`ContentHasher.ts`).
- Machine-managed `.orchestration/` sidecar artifacts (complete schema match).
- System Prompt enforcement.

**Partially Implemented / Naive:**

- `MutationClass` inference (currently hardcoded heuristically in `PostToolUseHook.ts`). True AST-level semantic diffing is deferred.
- The `TraceRecord.ranges` line counting falls back to estimations instead of deep AST parsing of `edit` chunks.

### Conceptual Linkage

- **Cognitive Debt:** Paid down by the `active_intents.yaml` and `CLAUDE.md`. The agent no longer has to guess the overarching goal or remember project rules.
- **Trust Debt:** Paid down by `agent_trace.jsonl`. Humans can inspect the sidecar to exactly verify _why_ an AI touched a file and _what_ intent authorized it.
- **Context Rot:** Solved by the "Checkout -> Act" state machine. By blocking un-scoped file writes, the agent is forced to continually align with the documented intent map.

### Lessons Learned

1. **Tool Interception boundaries:** Hooking into an existing execution loop (`presentAssistantMessage.ts`) requires extreme care. Returning structured text errors directly to the LLM is vastly superior to throwing runtime errors, because it leverages the LLM's natural self-correction abilities.
2. **Schema Rigidity vs AI Flexibility:** YAML is excellent for specs, but JSONL is mandatory for tracing. AI models occasionally mangle JSON structure when generating traces themselves; doing the tracing strictly in a deterministic TypeScript Post-Hook eliminates formatting errors.
