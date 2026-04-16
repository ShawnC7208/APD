# Adapter Guidance

APD is meant to be consumed through an adapter layer.

The adapter owns runtime policy. The model should reason within the current node; the adapter should enforce the procedure.

## What adapters should do

- load and validate the APD
- resolve runtime inputs
- track the current node
- expose only the relevant slice of the procedure to the model
- enforce approval gates
- verify completion checks before advancing
- record execution state outside APD
- emit AER when a concrete receipt is needed

## Launch adapters

This repo now includes two launch adapter paths:

- [`./strands`](./strands): export `.sop.md` files for Strands and the `strands-agents-sops` ecosystem
- [`./claude-skills`](./claude-skills): export minimal Claude Skill directories that wrap the SOP output in `SKILL.md` frontmatter

Both adapters build on the shared SOP export path described in [`./sop-md-mapping.md`](./sop-md-mapping.md).

## Runtime envelope

A focused runtime envelope typically includes:

- APD metadata
- current node
- reachable transitions
- resolved inputs
- current environment state
- execution policy

Keep graph traversal, approvals, and completion policy outside the model.

When adapters emit AER, prefer AER v0.2 for APD conformance checks. Compare the run to the APD contract first; replay-style comparison to original capture sessions is future work.

## Rule of thumb

APD is the reviewable procedure contract.

Markdown SOPs and Skills are runtime delivery formats.

Adapters are the bridge between them.
