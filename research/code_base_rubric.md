# Evaluation Rubric

## 1. Complete Implementation Architecture & Schemas
**Objective:** Determines if the report presents a fully realized, internally consistent architecture—not just a plan, but a reflection of what was actually built.

**Evidence to Verify:**
1. **Schema Precision:** Are the data models (intent specification, agent trace, intent map, shared brain) defined with exact field names, types, and update semantics? Can a reader reconstruct the data structures from the report alone?
2. **Architectural Justification:** Does the report explain why specific architectural decisions were made (e.g., why YAML over SQLite, why append-only for the trace, why a specific hashing strategy)?
3. **Internal Consistency:** Do the schemas, diagrams, and prose within the report agree with each other? Does the trace schema reference the same intent ID format described in the intent specification? Do field names stay consistent across sections?

**Scoring:**
* **5 pts | Implementation-Grade Documentation:** Every data model is defined with field-level precision, including update triggers and ownership (which hook writes to which file, and when). Architectural decisions are justified with explicit reference to the problem domain (Cognitive Debt, Trust Debt, Context Rot). The report honestly documents trade-offs, limitations, and deviations from the original plan. All sections are internally consistent. A developer unfamiliar with the project could reimplement the full system from this document alone.
* **3 pts | Accurate but Incomplete:** Schemas are well-defined with field names and types. Architecture is described with implementation-level specificity. Decisions are justified. However, coverage gaps exist (some components glossed over). May lack detail on data-level component interactions. No discussion of trade-offs/limitations.
* **1 pts | Surface-Level/Inconsistent:** A report exists but schemas are vague/generic (no field-level definitions). Architecture reads as aspirational rather than descriptive of a built system. Decisions stated without justification. Inconsistencies exist across sections.
* **0 pts | Non-Existent:** No implementation report submitted. No schemas, architecture descriptions, or data model definitions are present.

---

## 2. Agent Flow & Hook System Breakdown
**Objective:** Evaluates whether the report provides a detailed, step-by-step breakdown of how a single agent turn flows through the implemented system—from user input to final artifact update.

**Evidence to Verify:**
1. **End-to-End Trace:** Does the report walk through a concrete example showing every stage (prompt construction, intent selection, context injection, code generation, post-hook tracing, artifact updates)?
2. **Hook Behavior Specification:** For each hook (Pre and Post), does the report specify: (1) trigger, (2) data read, (3) data written/returned, and (4) failure behavior?
3. **State Machine Clarity:** Is the Two-Stage State Machine (or equivalent control flow) described with explicit state transitions, including blocked/rejected paths?
4. **Visual Artifacts:** Are diagrams present showing chronological flow, data payloads, and hook engine interruptions? Do they cover more than just the happy path?

**Scoring:**
* **5 pts | Complete Behavioral Specification** *(Criteria met comprehensively)*
* **3 pts | Clear Happy Path** *(Basic flow explained, but edge cases/failures omitted)*
* **1 pts | Abstract/Hand-Wavy** *(Vague description lacking technical step-by-step)*
* **0 pts | Non-Existent**

*(Note: Detailed scoring descriptions were omitted in the source text for this section).*

---

## 3. Achievement Summary & Reflective Analysis
**Objective:** Assesses the trainee's ability to honestly evaluate their own work—what was achieved, what fell short, and what they learned.

**Evidence to Verify:**
1. **Honest Inventory:** Does the report clearly separate what is fully implemented and working vs. partially implemented vs. not attempted? Are claims verifiable?
2. **Conceptual Linkage:** Does the trainee connect their implementation back to the problem domain (e.g., Cognitive Debt, Trust Debt, Context Engineering)?
3. **Lessons Learned:** Does the report document specific technical or architectural lessons encountered (not generic platitudes)?

**Scoring:**
* **5 pts | Rigorous Self-Assessment:** Precise inventory of implemented vs. missing features with verifiable claims. Explicitly maps each implemented component to the debt it repays. Technical lessons are specific and actionable. Identifies concrete next steps.
* **3 pts | Honest but Shallow:** Clearly separates what works from what does not with specific claims. Acknowledges limitations. Does not connect outcomes to the theoretical framework. Lessons learned are generic rather than technically specific.
* **1 pts | Vague/Inflated:** Summary claims everything works with no honest assessment of gaps. Claims are vague and unverifiable. No connection to theoretical framework. Reads as marketing copy.
* **0 pts | Non-Existent:** No summary or reflection provided.

---

## 4. Hook Architecture & Middleware Quality (Codebase)
**Objective:** Evaluate the structural quality of the hook system as implemented code. Looking for a clean Middleware/Interceptor pattern that is isolated, composable, and fail-safe.

**Evidence to Verify:**
1. **Separation of Concerns:** Is the hook logic encapsulated in its own module/directory, or scattered throughout existing files?
2. **Interceptor Pattern:** Is there a clear, uniform mechanism for tool execution requests to pass through hooks (e.g., pipeline, wrapper, event bus)?
3. **Fail-Safe Behavior:** If a hook throws an error, does the system degrade gracefully or crash the extension?
4. **Composability:** Could a new hook be added without modifying existing hook code or the host's core logic?

**Scoring:**
* **5 pts | Clean Middleware Pattern:** Hooks registered through a uniform interface. Host extension calls a single entry point unaware of individual implementations. Defined input/output types. Independent error boundaries. New hooks can be added via interface with zero host changes.
* **3 pts | Structured but Coupled:** Hooks live in a dedicated directory with recognizable Pre/Post structure, called at chokepoints. True composability is missing (host has direct knowledge of specific hooks). Implicit interface. Error boundaries may be incomplete.
* **1 pts | Spaghetti/Inline:** Hook-like logic is injected directly into the main execution loop via ad-hoc `if` blocks. Tightly coupled. No error handling (hook bug crashes agent). Adding hooks requires modifying core path.
* **0 pts | Non-Existent:** No hook implementation or trivial changes.

---

## 5. Context Engineering & Reasoning Loop Implementation
**Objective:** Verify that the Context-Injection Paradox is solved in code. The agent cannot act without first selecting an intent and receiving curated context (Three-State flow).

**Evidence to Verify:**
1. **The Trigger Tool:** Is the intent selection tool defined and registered for the LLM to call?
2. **System Prompt Mandate:** Is the System Prompt modified to mandate calling this tool before mutating actions?
3. **Interception & Injection:** Does the Pre-Hook extract constraints/scope from the intent file and return curated context (not a full dump)?
4. **The Gatekeeper:** Are mutating tools blocked with a structured error if attempted without a valid intent?

**Scoring:**
* **5 pts | Curated & Enforced:** Handshake fully implemented and un-bypassable. Selective context injection. Gatekeeper covers all mutating tools. Invalid selections return self-correcting structured errors. Intent status transitions respected. Aware of token budget.
* **3 pts | Functional Handshake:** Three-State flow works (tool call -> interception -> curated context returned). Gatekeeper blocks unsigned writes. System prompt enforces protocol. However, context may not be perfectly curated (e.g., dumps full file), gatekeeper may have bypasses, or missing handling for invalid/locked intents.
* **1 pts | Static/Bypass-able:** Intent file exists, dynamic handshake missing. Context dumped statically upfront. No gatekeeper (agent can write files without declaring intent). Two-stage flow missing in practice.
* **0 pts | Non-Existent:** No intent selection mechanism.

---

## 6. Intent-AST Correlation & Traceability
**Objective:** Evaluate the AI-Native Git layer implementation. Does the system produce a correct, verifiable trace linking business intents to code changes via content hashing?

**Evidence to Verify:**
1. **Trace Generation:** Is a trace entry generated automatically by a Post-Hook on file writes?
2. **Content Hashing:** Does code compute a SHA-256 (or equivalent) hash of the modified block?
3. **Intent Linkage:** Does each entry reference the active intent ID?
4. **Semantic Classification:** Does the system use heuristics to distinguish mutation classes (e.g., AST_REFACTOR vs. INTENT_EVOLUTION)?
5. **Schema Compliance:** Does the trace follow the specified schema (id, timestamp, vcs, files, ranges with hash, related specs)?

**Scoring:**
* **5 pts | Verifiable Ledger:** Trace entries complete per schema. Hashes computed from actual modified blocks (independently verifiable). Linked to handshake intent IDs. Semantic classification uses real heuristic/AST comparison. VCS IDs captured. Append-only and accurate.
* **3 pts | Functional Trace:** Post-Hook generates entries with actual file hashes and active intent IDs. Substantially correct schema. Semantic classification is absent or naive (e.g., everything labeled the same). VCS integration or metadata may be stubbed/hardcoded.
* **1 pts | Stub/Hardcoded:** Post-Hook writes to a trace file, but hashes are missing/hardcoded/wrong. Intent IDs missing/hardcoded. Classification absent. Schema deviates significantly.
* **0 pts | Non-Existent:** No trace generation logic.

---

## 7. .orchestration/ Artifacts Completeness & Correctness
**Objective:** Verify the sidecar storage contains all required artifacts in a machine-managed state (generated at runtime, not manually authored).

**Context:** Artifacts may originate from a test workspace where the extension was run.

**Evidence to Verify:**
1. **Artifact Presence:** Do the intent specification, trace ledger, spatial map, and shared brain exist?
2. **Machine-Managed Evidence:** Do artifacts show system generation (consistent formatting, UUIDs, chronological timestamps, correct hashes)?
3. **Internal Consistency:** Do cross-references match (trace intent IDs match spec IDs, spatial map files match a plausible codebase)?

**Scoring:**
* **5 pts | Coherent System State:** All artifacts exist, cross-reference correctly, and show lifecycle progression. Plausible timestamps, IDs, and hashes. Tells a coherent story of a governed session reconstructable by a grader.
* **3 pts | Partially Machine-Managed:** Most artifacts exist and show system generation. Intent specs and traces show updates. Complete internal consistency missing (some broken links, empty shared brain, spatial map doesn't reflect actual changes). Some files may appear hand-seeded.
* **1 pts | Manually Authored:** Directory exists but no evidence of machine management. Files appear hand-written (prose-like JSON, no state transitions). Inconsistent internal references.
* **0 pts | Non-Existent:** No `.orchestration/` directory submitted.

---

## 8. Git History & Engineering Process
**Objective:** Evaluate the engineering narrative across the full lifecycle. Looking for disciplined, iterative development over bulk-uploads.

**Evidence to Verify:**
1. **Full Lifecycle Progression:** Does history show evolution from Phase 0 (analysis) to Phase 4 (orchestration)?
2. **Iteration Evidence:** Are there commits for debugging, refactoring, or bug-fixing?
3. **Commit Discipline:** Are commits atomic and descriptive throughout?
4. **Sustained Development:** Is work distributed over time or dumped in a massive single commit?

**Scoring:**
* **5 pts | Master-Level Engineering Narrative:** Git log reads as a development journal. Atomic, descriptive commits mapped to architectural decisions. Clear evidence of iteration/refactoring. Work distributed over time.
* **3 pts | Structured Progression:** Logical progression matching project phases. Descriptive messages. Distributed over time. However, some commits bundle multiple concerns. Limited evidence of iteration (linear build-up with no debug/refactor commits).
* **1 pts | Bulk/Chaotic:** Implementation exists, but mostly in 1-2 large commits. No iteration. Uninformative messages ("updates", "final"). Code appears pasted in rather than incrementally developed.
* **0 pts | Non-Existent:** No meaningful commits beyond initial fork.
