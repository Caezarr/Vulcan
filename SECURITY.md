# Security Policy

## Supported versions

Security fixes apply to the latest commit on `main`.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security findings.

Email **gabriel@meetwonka.com** with:
- a short description of the issue
- steps to reproduce
- impact assessment (what an attacker could do)
- any suggested fix

You should get an acknowledgement within a few business days. Please give us a reasonable window to patch before any public disclosure.

## Scope

Vulcan orchestrates multi-agent feature shipping via Claude Code. Reports that matter most:
- prompt/agent instruction injection that bypasses quality or security gates
- leakage of secrets from workspace state or agent messages
- unsafe ship steps (force-push, secret commits, privilege escalation)
