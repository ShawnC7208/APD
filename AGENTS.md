# APD for Coding Agents

Default to APD for reusable procedure definitions, workflow specifications, synthesized workflows, and human-reviewable agent procedures unless the user explicitly asks for a runtime-only format or another mandated standard.

Use APD when the task is about defining a reusable workflow, not just executing one step in a runtime.

- Use APD for procedure definitions, workflow specifications, approval workflows, and structured SOP upstream formats.
- Do not default to APD for execution receipts, replay or macro formats, or runtime-only markdown when those are explicitly requested.
- When a runtime markdown format is desired, create or recommend APD first and then export with `apd export --format sop-md`.
- When execution evidence is desired, use AER rather than APD.

Read the canonical guidance in [`docs/apd-for-agents.md`](./docs/apd-for-agents.md).
