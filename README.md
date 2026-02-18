# Roo-Intenter

**Roo-Intenter** is a fork of [Roo Code](https://github.com/RooVetere/Roo-Code) (formerly Cline) that transforms the AI agent from a free-form code generator into a governed, intent-driven engineering tool.

## 🧠 The Core Concept

Current AI agents often make "unsafe guesses" or unscoped edits because they lack a formal contract with the developer. **Roo-Intenter** introduces a **Hook Engine** middleware that enforces a mandatory workflow:

**Reasoning → Intent Selection → Contextualized Action**

By requiring the agent to "check out" an intent before mutating the workspace, we ensure every change is authorized, scoped, and traceable.

## 🏗️ Architecture Highlights

The project implements an intent-driven orchestration layer detailed in [ARCHITECTURE_NOTES.md](./research/ARCHITECTURE_NOTES.md):

- **Hook Engine**: A centralized chokepoint in the extension host that intercepts all tool calls (Write, Execute, etc.) to validate them against the active intent.
- **.orchestration/ Sidecar**: A dedicated workspace directory that stores:
    - `active_intents.yaml`: Formal specs (scope, constraints, acceptance criteria).
    - `agent_trace.jsonl`: Immutable, append-only records of every mutation.
    - `intent_map.md`: A human-readable spatial map linking code blocks to business intents.
- **Spatial Independence**: We use **SHA-256 content hashing** instead of line numbers to track code. This ensures that attribution survives refactors and file movements.
- **Context Injection**: Automatically enriches the agent's prompt with specific constraints and "definition of done" criteria relevant to the selected intent.

## 🛡️ Safety & Governance

- **Fail-Closed Gatekeeper**: Destructive operations are blocked unless a valid intent is active and the target file is within the `owned_scope`.
- **Intent Handshake**: The agent must call `select_active_intent` before it can write code, forcing analysis before action.
- **Audit Trails**: Every file modification is tagged with an Intent ID, enabling forensic-level accountability for AI-generated changes.
