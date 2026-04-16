# Claude Skills Adapter

This adapter path exports a minimal Claude Skill directory from an APD.

It uses the shared SOP markdown exporter, then wraps that content in a `SKILL.md` file with the required `name` and `description` frontmatter fields.

## Export a skill directory

From the repo root:

```bash
node adapters/claude-skills/export-skill.js examples/invoice-logging.apd.json adapters/claude-skills/demo/skills
```

That writes:

- [`./demo/skills/log-invoice-to-tracker/SKILL.md`](./demo/skills/log-invoice-to-tracker/SKILL.md)

## Format

The generated skill uses:

- one folder per skill
- `SKILL.md`
- YAML frontmatter with `name` and `description`
- the exported SOP markdown as the body

This follows the public Anthropic examples closely enough for launch scaffolding while keeping the export path deterministic and easy to inspect.

## Usage

Use the generated skill directory with your preferred Claude workflow:

- Claude Code plugin development
- Claude.ai skill upload
- API-based skill registration

## References

- [`../sop-md-mapping.md`](../sop-md-mapping.md)
- [`../../docs/apd-to-sop-example.md`](../../docs/apd-to-sop-example.md)
