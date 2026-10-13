
# SecureShip — Threat Model

## 1. Purpose

Identify the main security risks affecting
SecureShip and define how they will be
detected, prevented, and validated.

## 2. Assets to Protect

- Application source code
- Third-party dependencies
- Credentials and secrets
- Docker container images
- Infrastructure configurations
- CI/CD pipeline integrity

## 3. Identified Threats

### T01 — Insecure Application Code

Risk:
Vulnerable coding patterns may introduce
security weaknesses.

Security Tool: Semgrep

### T02 — Vulnerable Dependencies

Risk:
Third-party Python packages may contain
known vulnerabilities.

Security Tool: Trivy

### T03 — Exposed Secrets

Risk:
Credentials or API keys may accidentally
be committed to the repository.

Security Tool: Gitleaks

### T04 — Container Vulnerabilities

Risk:
The Docker image may contain vulnerable
packages or insecure components.

Security Tool: Trivy

### T05 — Insecure Infrastructure

Risk:
Terraform configurations may introduce
unsafe permissions or exposed resources.

Security Tool: Checkov

## 4. Risk Treatment Strategy

For each identified risk:

1. Run the corresponding security check.
2. Review the reported findings.
3. Identify and prioritize real risks.
4. Apply an appropriate remediation.
5. Rerun the same check.
6. Preserve evidence of the results.

## 5. Validation Strategy

Controlled test cases will be introduced
in isolated development branches.

No real credentials or sensitive data
will be used.

Security checks will be validated by
comparing results before and after
remediation.

## 6. Current Status

Threats identified.
Security controls planned.
Validation pending implementation.
