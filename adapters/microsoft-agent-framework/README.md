# Microsoft Agent Framework Adapter

This adapter path treats APD as the upstream authoring and review format, then executes APD JSON directly through a Microsoft Agent Framework adapter-owned runtime loop.

## Why this path exists

Microsoft Agent Framework already provides a strong agent and workflow runtime. The goal here is not to replace that runtime model, but to show that APD can stay the reviewable contract upstream of it.

Unlike the Strands adapter path, this adapter does not add a new markdown export format. It runs APD JSON directly and emits AER v0.2 as the execution receipt.

## APD-aware AER demo

[`./demo/run_apd_with_aer.py`](./demo/run_apd_with_aer.py) shows the APD-aware reference path:

- load the APD JSON directly
- validate the APD with the checked-in CLI before execution
- execute one node at a time through an adapter-owned loop
- keep approvals and transitions outside the model
- emit an AER v0.2 receipt through the local Python recorder helper at [`./demo/aer_recorder.py`](./demo/aer_recorder.py)

This repo does not vendor Microsoft Agent Framework or provider configuration, so treat the script as a minimal integration example rather than a fully pinned demo environment.

Prerequisites for live mode:

- Python 3
- the `agent-framework` package installed in your active environment
- the `azure-identity` package installed in your active environment
- Azure CLI authentication already configured with `az login`
- a reachable Microsoft Foundry project endpoint and deployed model

Install and sanity-check the imports:

```bash
python3 -m pip install agent-framework azure-identity
python3 -c "from agent_framework.foundry import FoundryChatClient; print('Agent Framework import OK')"
```

Run the APD-aware AER demo in deterministic mock mode:

```bash
python3 adapters/microsoft-agent-framework/demo/run_apd_with_aer.py --apd examples/invoice-logging.apd.json --mock
```

Validate and compare the emitted receipt:

```bash
python3 adapters/microsoft-agent-framework/demo/run_apd_with_aer.py --apd examples/invoice-logging.apd.json --mock --output /tmp/invoice-maf.aer-v0.2.json
node packages/cli/bin/apd.js aer validate /tmp/invoice-maf.aer-v0.2.json --strict
node packages/cli/bin/apd.js aer compare examples/invoice-logging.apd.json /tmp/invoice-maf.aer-v0.2.json
```

Run the live path with Microsoft Foundry:

```bash
export APD_MAF_PROJECT_ENDPOINT="https://your-project.services.ai.azure.com/api/projects/your-project"
export APD_MAF_MODEL="gpt-5.4-mini"
python3 adapters/microsoft-agent-framework/demo/run_apd_with_aer.py --apd examples/invoice-logging.apd.json
```

The script also accepts the Microsoft-style environment variable names `AZURE_AI_PROJECT_ENDPOINT` and `AZURE_AI_MODEL_DEPLOYMENT_NAME`.

## Notes

- Mock mode is deterministic and does not require `agent-framework`.
- Live mode uses the official Python `agent-framework` package and a `FoundryChatClient`.
- Approval nodes remain adapter-owned; the model is never asked to self-approve.
- The runtime envelope includes only the current node, reachable transitions, and resolved bindings rather than the whole APD graph.
- This adapter path does not add a new CLI export format and does not include a NuGet package.

## References

- [`../README.md`](../README.md)
- [`../../spec/agent-execution-record-aer-v0.2.md`](../../spec/agent-execution-record-aer-v0.2.md)
