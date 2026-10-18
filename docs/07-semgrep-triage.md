# Semgrep SAST — Security Findings Triage

## Scan information

- Tool: Semgrep OSS
- Command: `semgrep scan --config auto --error app/ frontend/src/`
- Rules executed: 452
- Files scanned: 25
- Findings: 3
- Exit code: 1

## Finding 1 and 2 — Dynamic ALTER TABLE

**Location:** `app/database.py`, `init_database()`

**Issue:** Semgrep detects SQL built using an f-string.

**Investigation:** The interpolated column names and types originate from the hardcoded `_ADDED_COLUMNS` dictionary. No user-controlled input is used in these SQL identifiers.

**Assessment:** Likely false positives for SQL injection.

## Finding 3 — Dynamic SELECT COUNT

**Location:** `app/database.py`, `count_shipments()`

**Issue:** Semgrep detects a dynamically assembled SQL query.

**Investigation:** `_build_filters()` constructs the WHERE clause using fixed SQL fragments. User-provided values are passed separately as bound SQLite parameters (`?`).

**Validation:** A SQL injection regression test using `' OR 1=1 --` returned zero matches for both search and status filters. The full Pytest suite passed: 53/53.

**Assessment:** Likely false positive for SQL injection.

## Limitations

The test covers one SQL injection payload and selected database operations. It does not establish that every SQL injection technique or every database operation is safe.

## Next action

Review and justify narrowly scoped Semgrep suppressions for the existing findings, preserve the automated SQL injection regression test, and enable a blocking Semgrep job in GitHub Actions. Validate the gate against a deliberately vulnerable test fixture.