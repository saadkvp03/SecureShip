# SecureShip — Project Scope & Architecture

## 1. Project Purpose

Build a small shipment management application and progressively secure its software development and delivery lifecycle using DevSecOps practices.

SecureShip is a hands-on cybersecurity engineering project combining:

- Application development.
- Automated functional testing.
- Containerization.
- Source code version control.
- Continuous Integration (CI).
- Automated security analysis.
- Vulnerability remediation and validation.

The project follows a **Build → Test → Secure → Validate** approach.

## 2. Business Scenario

SecureShip represents a fictional logistics company that manages customer shipments.

The company needs an application to register shipments, track their status, and retrieve shipment information.

The long-term objective is to integrate automated security controls into its development process so that potential vulnerabilities, exposed secrets, insecure configurations, and vulnerable dependencies can be identified before application changes are accepted.

**Environment:** Educational laboratory using fictional data only.

## 3. Application Features

### 3.1 Implemented Features

The application provides a REST API developed with Python and FastAPI.

Available endpoints:

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Retrieve application information |
| GET | `/health` | Check application availability |
| POST | `/shipments` | Create a new shipment |
| GET | `/shipments` | Retrieve stored shipments |
| PATCH | `/shipments/{shipment_id}/status` | Update shipment status |

Shipment statuses:

- `created`
- `in_transit`
- `delivered`

### 3.2 Data Storage

- SQLite database for persistent shipment storage.
- Database initialization during application startup.
- SQL parameterized queries for database operations.
- Configurable database path using `SECURESHIP_DB_PATH`.
- Fictional test data only.

### 3.3 Automated Testing

- Pytest test suite.
- FastAPI TestClient for API testing.
- Isolated temporary databases during testing.
- Nine automated tests implemented and passing.

The tests cover API operations, validation, error handling, status updates, and data persistence.

### 3.4 Containerization

The application is packaged using Docker.

Implemented characteristics:

- Python 3.11-based container image.
- Application execution through Uvicorn.
- Non-root application user.
- Application port 8000.
- Named Docker volume for SQLite persistence.
- Localhost port binding for development.

Docker execution, non-root operation, and persistent-volume behavior have been verified in the local environment.

## 4. System Architecture

### 4.1 Current Application Architecture — Implemented

```text
            Client / Swagger UI
                    |
                    | HTTP
                    v
          +---------------------+
          |    FastAPI REST API |
          |                     |
          | GET /health         |
          | POST /shipments     |
          | GET /shipments      |
          | PATCH /shipments/id |
          +---------------------+
                    |
                    v
          +---------------------+
          | Database Operations |
          |  Python + SQLite3   |
          +---------------------+
                    |
                    v
          +---------------------+
          |   SQLite Database   |
          |     secureship.db   |
          +---------------------+
```

When running with Docker:

```text
       Local Developer Machine
                  |
          127.0.0.1:8000
                  |
                  v
       +----------------------+
       |   Docker Container   |
       |                      |
       |   FastAPI + Uvicorn  |
       |   Non-root user      |
       +----------------------+
                  |
                  v
       +----------------------+
       | Named Docker Volume  |
       |    secureship-data   |
       |                      |
       |     SQLite DB        |
       +----------------------+
```

The named volume allows shipment data to persist when the application container is stopped and recreated using the same volume.

### 4.2 Planned DevSecOps Architecture — Not Yet Implemented

```text
                 Developer
                     |
                     v
              Local Git Repo
                     |
                     | git push
                     v
              GitHub Repository
                     |
                     v
               GitHub Actions
                     |
      +--------------+--------------+
      |              |              |
      v              v              v
 Functional       Security       Security
  Testing        Code Checks    Configuration
  (Pytest)        (Semgrep)       Validation
                                  (Checkov)
      |              |              |
      +--------------+--------------+
                     |
             +-------+-------+
             |               |
             v               v
         Dependency       Secret
          Scanning       Detection
           (Trivy)       (Gitleaks)
             |               |
             +-------+-------+
                     |
                     v
             Security Validation
                     |
              +------+------+
              |             |
              v             v
             FAIL          PASS
              |             |
              v             v
        Investigate      Docker Image
        and Remediate    Build / Check
              |
              v
        Retest Changes
```

This diagram represents the **target architecture**, not the current operational pipeline.

The exact workflow jobs, execution order, failure policies, and security tools will be configured and validated during the upcoming DevSecOps phases.

## 5. Security Objectives

The project aims to:

- Detect insecure application code patterns.
- Identify vulnerable third-party dependencies.
- Prevent accidental exposure of credentials and secrets.
- Identify insecure container configurations.
- Validate Infrastructure as Code configurations.
- Enforce security checks during Continuous Integration.
- Investigate identified vulnerabilities.
- Apply corrective security measures.
- Verify remediation effectiveness.
- Document evidence of security findings and validation results.

Security testing will be conducted exclusively in controlled environments.

**Current security limitations:**

- Authentication and authorization are not implemented.
- The API is not intended for production deployment.
- Automated security scanning is not yet configured.
- CI/CD security gates have not yet been implemented.

## 6. Expected Deliverables

### Completed Deliverables

- [x] FastAPI REST application.
- [x] SQLite database integration.
- [x] Automated functional tests.
- [x] Dockerfile and `.dockerignore`.
- [x] Non-root container execution.
- [x] Persistent SQLite storage with Docker volumes.
- [x] Initial project documentation.

### Planned Deliverables

- [ ] Local Git repository and initial commit.
- [ ] GitHub remote repository.
- [ ] GitHub Actions CI pipeline.
- [ ] Automated application security scanning.
- [ ] Dependency and container vulnerability analysis.
- [ ] Automated secret detection.
- [ ] Infrastructure as Code security validation.
- [ ] Security findings and remediation reports.
- [ ] Evidence of failed and successful pipeline checks.
- [ ] Final technical and security report.

## 7. Project Limitations

- No real customer data.
- No production infrastructure.
- No paid cloud services required.
- No Kubernetes in the initial version.
- No real credentials committed to Git.
- No public production deployment of the intentionally insecure application.
- Security testing limited to authorized laboratory environments.
- Deliberately insecure changes, if introduced, will be tested only in controlled environments and branches.
- The project's objective is practical learning and technical demonstration, not production certification.

## 8. Success Criteria

The project will be considered complete when:

1. The REST API operates correctly and passes functional tests.
2. SQLite data persistence is verified.
3. The application runs successfully in Docker.
4. The source code is versioned using Git and hosted on GitHub.
5. GitHub Actions automatically executes functional tests.
6. Automated security checks execute successfully.
7. A controlled security issue causes the relevant pipeline check to fail.
8. A documented remediation corrects the identified issue.
9. The corrected implementation passes the same security check.
10. The Docker image builds successfully in the defined CI workflow.
11. Technical findings, evidence, and remediation actions are documented.
12. Another developer can reproduce the project and its verification procedures.

## 9. Current Status

**Project phase:** Application implementation completed; preparation for Git and CI/CD integration.

**Implementation:** In progress.

### Completed

- Project scope and initial architecture.
- FastAPI REST API.
- SQLite database persistence.
- Nine automated Pytest tests.
- Docker containerization.
- Non-root Docker execution.
- Persistent Docker volume configuration and verification.
- README and architecture documentation updates.

### Next Steps

1. Initialize Git version control.
2. Inspect tracked and ignored files.
3. Create the initial Git commit.
4. Create and connect a GitHub repository.
5. Configure GitHub Actions to execute automated tests.
6. Integrate security analysis tools progressively.
7. Investigate, remediate, and validate security findings.
8. Finalize project documentation and reporting.

**Current milestone:** Preparing SecureShip for its first Git commit.

---

*SecureShip — Educational Cybersecurity Engineering & DevSecOps Project*