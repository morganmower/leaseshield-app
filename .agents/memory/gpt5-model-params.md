---
name: gpt-5 model param constraints
description: API differences when using gpt-5* models (e.g. gpt-5-mini) via the Replit OpenAI integration proxy vs gpt-4o*
---

When migrating OpenAI chat.completions calls from `gpt-4o*` to a `gpt-5*` reasoning
model (e.g. `gpt-5-mini`) through `AI_INTEGRATIONS_OPENAI_BASE_URL`:

- `max_tokens` is REJECTED (HTTP 400). Must rename to `max_completion_tokens`.
- `temperature` only accepts the default value 1. Any custom value (0, 0.3, 0.7)
  returns HTTP 400. Remove the param entirely.
- Reasoning tokens are billed against `max_completion_tokens`. Trivial calls burned
  ~128 reasoning tokens before any output. Small budgets (e.g. 50) yield EMPTY
  content. Raise budgets generously so output isn't starved (classifier 50 -> 600).

**Why:** gpt-5 is a reasoning model; these are hard API constraints, not stylistic.
**How to apply:** any model-id swap to gpt-5* must also strip temperature, switch
to max_completion_tokens, and inflate token limits — a bare identifier swap leaves
calls returning 400s or empty strings. Verify with a live proxy test call.
