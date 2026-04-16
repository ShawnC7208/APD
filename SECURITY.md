# Security Policy

## Supported versions

The APD-Spec repository is in active development. Security fixes target the latest `main` branch and the most recently published versions of `@apd-spec/sdk` and `@apd-spec/cli`.

## Reporting a vulnerability

Please do **not** open a public GitHub issue for suspected security problems.

Instead, use GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/ShawnC7208/APD/security) on this repository.
2. Click **Report a vulnerability**.
3. Include: affected package or file, reproduction steps, impact, and (if known) a proposed fix.

You can expect:

- Acknowledgement within 5 business days.
- An initial assessment within 10 business days.
- Coordinated disclosure on a timeline proportional to severity.

## Scope

In scope:

- `@apd-spec/sdk` parsing, validation, and export logic
- `@apd-spec/cli` file handling and command execution
- Schema and fixture integrity

Out of scope:

- Third-party adapters and downstream runtime integrations
- Vulnerabilities in ajv or other upstream dependencies (report those upstream)
