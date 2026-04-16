# APD to SOP Markdown Mapping

This document defines the deterministic mapping used by `toSopMarkdown` and `apd export --format sop-md`.

It follows the section expectations documented by the Strands agent-sop format rule while preserving APD-specific review breadcrumbs as HTML comments.

## File shape

Generated files use:

- `.sop.md` file extension
- `Overview`
- `Parameters`
- `Steps`
- `Outcomes`
- `Examples`
- `Troubleshooting`

## Mapping rules

### Top-level metadata

- `title` -> markdown `#` heading
- `summary` -> `## Overview`
- `entry_conditions[]` -> "Use this SOP when" bullets in `Overview`
- `provenance.observed_vs_inferred_summary` -> provenance note in `Overview`

### Parameters

- `inputs_schema.properties` -> `## Parameters`
- requiredness comes from `inputs_schema.required[]`
- schema `default` values are rendered inline when present
- schema `enum` values are rendered as allowed values when present

### Actions

- `action` nodes -> numbered steps
- `instruction` -> step body
- `produces[]` -> plain-language note in the step body
- `risk` and `confirmation_required` -> RFC 2119 constraints
- `pre_state_checks[]` -> mandatory preconditions
- `completion_checks[]` -> mandatory completion constraints

### Decisions

- `decision` nodes -> numbered steps with a `Decision paths` subsection
- outgoing transitions -> conditional path bullets
- `evaluation_hint` -> `SHOULD` guidance in the constraints section

### Approvals

- `approval` nodes -> numbered "stop and request approval" steps
- approval reason -> mandatory constraint
- outgoing transitions -> post-approval continuation guidance

### Terminals

- `terminal` nodes -> `## Outcomes`

### Recovery

- node `recovery` -> `## Troubleshooting`

### Provenance markers

- `observed_vs_inferred` on nodes and transitions is omitted from runtime prose
- the exporter preserves it as HTML comments so the markdown can still be traced back to APD during debugging or round-trip analysis

## Intentional non-goals

The exporter does not try to preserve the entire APD review surface in the runtime markdown.

It intentionally leaves these upstream:

- full provenance metadata
- capture scope
- review confidence
- source session identifiers

Those belong in APD, not in the runtime-facing SOP body.
