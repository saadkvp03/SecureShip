# Semgrep SAST — Findings Triage and CI Validation

**Project:** SecureShip\
**Scope:** local-only educational security laboratory\
**Review baseline:** 18 October 2026\
**Status:** initial findings reviewed; narrowly scoped suppressions applied; blocking SAST gate enabled and passing in GitHub Actions.

## 1. Scope and scan configuration

SecureShip uses **Semgrep OSS** to scan the FastAPI backend and React frontend for code patterns that may indicate security issues.

```bash
semgrep scan --config auto --error app/ frontend/src/
```

The `semgrep` job in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) installs `semgrep==1.180.0` and runs this command. The `--error` flag makes reported, unsuppressed findings cause a nonzero exit status, so the CI job can block the change.

**Recorded initial scan (before triage):** 452 rules executed, 25 files scanned, **3 findings**, exit code **1**. These numbers refer to that scan, not an immutable count for future runs; the effective ruleset and files scanned can change.

## 2. Findings and technical assessment

| Finding | Location | Semgrep concern | Triage assessment |
| --- | --- | --- | --- |
| 1–2 | `app/database.py` — `init_database()` | Formatted SQL in `ALTER TABLE ... ADD COLUMN` | Likely false positives in the reviewed implementation: column names and SQL types come exclusively from the module's fixed `_ADDED_COLUMNS` mapping. |
| 3 | `app/database.py` — `count_shipments()` | Formatted SQL in `SELECT COUNT(*) ...` | Likely false positive in the reviewed implementation: `_build_filters()` constructs its SQL clause from fixed fragments while user-supplied values are bound separately as SQLite parameters (`?`). |

### Findings 1–2: schema migration

The `init_database()` function supports a non-destructive upgrade of older local SQLite databases. The only values interpolated into its `ALTER TABLE` expression are identifiers and SQL types from the hardcoded `_ADDED_COLUMNS` dictionary; neither is derived from a request parameter.

Because SQL identifiers cannot be parameterized in the same way as values, the safety argument depends on preserving this trusted, fixed mapping. **If these identifiers ever become user-controlled or externally configurable, the finding must be reassessed.**

### Finding 3: dynamic counting query

`count_shipments()` receives the WHERE clause and bound parameters from `_build_filters()`. The latter appends predefined SQL fragments and places search/status values in a separate parameter list. The query execution passes that list to `sqlite3.Connection.execute()` rather than interpolating the user values into SQL text.

The same design is used by `list_shipments()`, which additionally restricts sort expressions through `_SORT_EXPRESSIONS` and maps the requested order to `ASC` or `DESC`.

## 3. Treatment: reviewed, rule-specific suppressions

After reviewing the implementation, we added **in-code `nosemgrep` comments** next to the two relevant SQL execution sites in `app/database.py`. The comments specify particular Semgrep rule identifiers rather than disabling Semgrep globally:

- `init_database()` — `python.lang.security.audit.formatted-sql-query.formatted-sql-query` and `python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query`.
- `count_shipments()` — `python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query`.

These are exceptions for the **specific reviewed code sites**, not a general authorization to assemble SQL from untrusted input. The comments in the source refer back to this document to preserve the rationale for future reviews.

**Risk decision:** accept the narrowly scoped static-analysis exceptions for the current local-lab implementation, retain parameter binding and fixed SQL fragments, and re-review the suppressions whenever the database/query-building logic changes.

## 4. Regression testing

The regression test [`tests/test_sqli_regression.py`](../tests/test_sqli_regression.py) creates an isolated temporary SQLite database, inserts a fictional shipment, and supplies the following SQL-injection-like string to both the search and status filters:

```text
' OR 1=1 --
```

The test asserts that `count_shipments()` returns zero matches for those filters and that `list_shipments()` returns empty lists. This supports the assessment that, along the **tested code paths**, the supplied string is handled as data rather than executed as SQL.

The project's full local Pytest suite passed **53/53 tests** during the October 2026 validation.

## 5. Blocking CI gate: implemented and verified

The original triage action item to enable Semgrep's blocking gate is **completed**.

- Workflow job: `semgrep` / **Semgrep SAST** in [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).
- Command: `semgrep scan --config auto --error app/ frontend/src/`.
- GitHub validation: [security-hardening PR #2](https://github.com/saadkvp03/SecureShip/pull/2) was merged after its CI checks passed; subsequent `main` workflow executions also passed the Semgrep job.
- **Local detection demonstration:** a separate disposable Semgrep fixture scanned with `--error --no-git-ignore` produced **2 blocking findings** and **exit code 1** (290 rules against 1 test file). This confirms the scanner's blocking exit behavior for that local example; it is **not** evidence of a failed GitHub Actions run on SecureShip. See [the local blocking demonstration](assets/semgrep-blocking-demo.png).
- **Project baseline:** the reviewed SecureShip source produced **0 remaining unsuppressed findings** in the recorded local scan (452 rules, 25 files), and the GitHub Actions Semgrep job passed. See the [before-triage](assets/semgrep-before-triage.png) and [after-triage](assets/semgrep-after-triage.png) screenshots.

The source suppressions are checked into the repository, so future scans can continue to enforce other findings without re-triggering the same reviewed warnings, subject to rule/version changes.

## 6. Limitations and future review

- Semgrep is **static pattern analysis**; a green result does not prove the application has no SQL injection or other vulnerabilities.
- The automated SQLi regression covers one representative payload and selected query paths. It does not establish comprehensive injection resistance.
- A new code path, a modification to `_ADDED_COLUMNS` or `_build_filters()`, or a future change to the Semgrep ruleset can invalidate the current triage. Reevaluate the implementation and suppressions when these change.
- Maintain a separate threat model, code review, dependency/image scanning and future authorized OWASP ZAP testing. DAST is **not yet implemented** in this phase.

## 7. Related documentation

- [Security findings](03-security-findings.md)
- [Remediation and validation](04-remediation-validation.md)
- [Authentication security design](06-authentication.md)
- [GitHub Actions workflow](../.github/workflows/ci.yml)

**Conclusion:** The three initial Semgrep warnings were investigated and documented, rule-specific exceptions were limited to reviewed SQL construction sites, a focused SQLi regression test was retained, and the Semgrep CI gate is now active and passing. This is an evidence-based triage outcome, not a guarantee of complete application security.
