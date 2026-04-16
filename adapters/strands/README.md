# Strands Adapter

This adapter path treats APD as the upstream authoring and review format, then exports `.sop.md` files for the Strands Agent SOP ecosystem.

## Why this path exists

Strands already has a strong markdown SOP runtime story. The goal here is not to replace that story, but to feed it from APD after review.

## Export a SOP file

From the repo root:

```bash
node adapters/strands/export-sop.js examples/invoice-logging.apd.json adapters/strands/demo/agent-sops
```

That writes:

- [`./demo/agent-sops/log-invoice-to-tracker.sop.md`](./demo/agent-sops/log-invoice-to-tracker.sop.md)

You can also use the public CLI directly:

```bash
node packages/cli/bin/apd.js export examples/invoice-logging.apd.json --format sop-md --output adapters/strands/demo/agent-sops/log-invoice-to-tracker.sop.md
```

## Demo agent

[`./demo/run_demo.py`](./demo/run_demo.py) shows the minimal Strands wiring:

- load the exported SOP markdown
- use it as the agent system prompt
- run the agent against a user task

[`./demo/run_apd_with_aer.py`](./demo/run_apd_with_aer.py) shows the APD-aware reference path:

- load the APD JSON directly
- execute one node at a time through an adapter-owned loop
- keep approvals and transitions outside the model
- emit an AER v0.2 receipt through the local Python recorder helper at [`./demo/aer_recorder.py`](./demo/aer_recorder.py)

This repo does not vendor Strands or model-provider configuration, so treat the script as a minimal integration example rather than a fully pinned demo environment.

Prerequisites:

- Python 3
- the `strands-agents` package installed in your active environment
- a working Strands-compatible model provider already configured in your shell

Install and sanity-check the import:

```bash
python3 -m pip install strands-agents
python3 -c "from strands import Agent; print('Strands import OK')"
```

Then run the demo:

```bash
python3 adapters/strands/demo/run_demo.py "Start the invoice logging workflow"
```

Run the APD-aware AER demo in deterministic mock mode:

```bash
python3 adapters/strands/demo/run_apd_with_aer.py --apd examples/invoice-logging.apd.json --mock
```

## Notes

- If Strands is missing, the script exits with an explicit install message.
- If Strands and your provider config are available, the script prints a single agent response to stdout for the supplied task.
- The checked-in demo SOP is deterministic; the agent response is not.
- The checked-in demo SOP is generated from the APD example in this repo.
- The runtime response will vary with the configured model provider.
- The APD-aware AER demo uses a deterministic mock path for smoke coverage and can optionally call Strands in live mode.

## References

- [`../sop-md-mapping.md`](../sop-md-mapping.md)
- [`../../docs/apd-to-sop-example.md`](../../docs/apd-to-sop-example.md)
