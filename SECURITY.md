# Security

pesakit handles merchant credentials and payment state. Report vulnerabilities privately.

- Email: tullapeople@gmail.com with subject `pesakit security`
- Or use GitHub's private vulnerability reporting on the repository.

You will get a reply within 5 working days. Fixes ship as a patch release with a GitHub security advisory. Please do not open a public issue for security reports.

## Scope

- Credential leakage through logs or errors
- IPN handling that could be spoofed into marking an order paid
- Dependency or supply chain issues in the published package

## Not in scope

- Pesapal's own API or merchant dashboard (report to Pesapal)
- Issues in example apps under `examples/`
