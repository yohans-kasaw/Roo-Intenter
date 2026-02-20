# Shared Knowledge Base

This file contains lessons learned and architectural decisions shared across agent sessions.

### [2023-10-26T10:15:00Z] DECISION

Use Pre/Post hooks mapped around the tool execution loop instead of replacing the entire loop. This preserves native functionality and error-handling.

### [2023-10-28T09:20:00Z] LESSON

Line ranges are difficult to extract accurately from LLM patch payloads without parsing the patch format. We will extract them heuristically from the line ranges requested in the tool args.
