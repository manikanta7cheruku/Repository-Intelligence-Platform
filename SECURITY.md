# Security policy

## Reporting a vulnerability

Use GitHub private vulnerability reporting on this repository (Security tab, "Report a vulnerability").
Do not open a public issue. Expect an initial response within 7 days.

## Scope

This project analyzes untrusted repositories. The following are in scope and treated as high priority:

- Arbitrary code execution through analyzed content
- Path traversal or unsafe archive extraction
- Server side request forgery in the hosted service
- Token or secret leakage in logs, caches, or reports
- Cross-user data access
- Cross-site scripting in rendered reports

## Supported versions

Pre-1.0: only the latest release receives fixes.
