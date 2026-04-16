---
name: sonarqube-fix
description: >
  Use this skill when asked to fix SonarQube issues, apply SonarQube analysis, run the
  sonarqube-prompt-factory tool, or process code quality issues from SonarQube. Also triggers
  on "clean up sonar issues", "fix code quality", "run sonar prompts", or any request to
  apply fixes from generated sonarqube prompt files. Use it for the full workflow (generate
  then apply) or for just the apply step if prompt files already exist.
---

# sonarqube-fix Skill

Automates the full SonarQube fix workflow: generate per-file fix instructions from a live
SonarQube project, then apply each fix precisely as specified. The tool does not fix code
directly — it produces surgical instructions. You are the tool that applies them.

**Two phases. Run them sequentially, or enter at Phase 2 if prompts already exist.**

---

## Phase 1 — Generate Fix Prompts

### 1.1 Verify setup

Check the tool is installed globally:

```bash
sonarqube-prompt-factory --help
```

If this fails: the tool is not installed globally. Install it from the tool's source directory:

```bash
cd <sonarqube-prompt-factory-repo>
uv tool install .
```

If uv is not available or SSL fails during install, see the SSL troubleshooting section below.

### 1.2 Determine configuration

Check if a config file exists in the current directory:

```bash
ls config.yaml 2>/dev/null || echo "no config file"
```

**If a config file exists** — use it, no further questions needed:

```bash
sonarqube-prompt-factory --config config.yaml --test-connection
```

**If no config file exists** — the tool reads credentials from environment variables
(`SONARQUBE_URL`, `SONARQUBE_TOKEN`, `LLM_BASE_URL`, `LLM_API_KEY`). Ask the user
for only the two values that have no env var fallback:

- `project_key` — the SonarQube project key (e.g. `my-app` or `com.example:my-app`)
- `llm_model` — the model name to use (e.g. `gpt-4o`, `claude-sonnet-4-6`)

Also confirm the branch:

```bash
git rev-parse --abbrev-ref HEAD
```

Show the inferred branch to the user and ask them to confirm or override. If the
directory is not a git repo, ask the user for the branch name explicitly.

Then test connectivity:

```bash
sonarqube-prompt-factory --project-key <key> --test-connection
```

If either service shows FAILED: stop and report the specific error. Do not proceed.

### 1.3 Run the generator

**With config file:**
```bash
sonarqube-prompt-factory --config config.yaml [additional flags]
```

**Without config file:**
```bash
sonarqube-prompt-factory \
  --project-key <key> \
  [--branch <branch>] \
  [additional flags]
```

The tool infers the branch from git automatically — only pass `--branch` if the user
confirmed a different branch in step 1.2, or if the repo is not a git repo.

Common optional flags:
- `--severities BLOCKER,CRITICAL` — default is BLOCKER,CRITICAL,MAJOR
- `--max-issues 50` — cap for large projects
- `--output-dir ./sonar-fixes` — default is `./prompts`
- `--all-code` — include issues outside the new code period

Capture the exit code. Exit 0 = success or partial success. Exit 1 = fatal failure
(config error, connectivity failure). Partial failures (some files failed LLM analysis)
still exit 0 — the manifest shows which files failed.

### 1.4 Locate the manifest

After generation, the output directory contains `_manifest.json`. Read it:

```bash
cat <output_dir>/_manifest.json
```

This is your work order. `successful_files` lists prompt files to apply, ordered by issue
count descending (most issues first). `failed_files` lists files that could not be analyzed.

**If `_manifest.json` is absent** (older tool version): fall back to listing prompt files:

```bash
ls <output_dir>/*.md | grep -v _SUMMARY.md | sort
```

Report to the user: `successful_files` count, `failed_files` count, total issues.

---

## Phase 2 — Apply Fixes

Process each entry in `successful_files` in order. For each file:

### 2.1 Read the prompt file

```bash
cat <output_dir>/<prompt_file>
```

The file contains numbered fix blocks. Each block has:
- **Line(s)**: the line number(s) to change
- **Before**: exact code to replace
- **After**: exact replacement code
- **Reason**: brief justification

### 2.2 Apply fixes to the source file

Open the source file at `file_path` (relative to the repository root).

For each fix block, in order of line number ascending:

1. Locate the **Before** code in the source file. It must match exactly (whitespace included).
2. Replace it with the **After** code.
3. If the **Before** code is not found: log a warning with the fix number and rule key.
   Do not skip the remaining fixes — continue with the next one.

**Critical constraints — the prompt file states these explicitly:**
- Apply ONLY the listed changes
- Do NOT modify code outside the specified lines
- Do NOT refactor, rename, or reorganize beyond what is specified
- If two fixes conflict (adjacent or overlapping lines), apply the higher-severity fix
  first, then re-evaluate whether the lower-severity fix still applies cleanly

### 2.3 Run tests after each file

After applying all fixes for a file, run the project's test suite (or the test file
most closely associated with the changed source file):

```bash
# Examples — adapt to the project's test runner:
uv run pytest tests/ -x -q
./gradlew test
npm test
go test ./...
```

If tests fail after applying fixes for a file:
1. Report which test failed and which fix likely caused it
2. Do NOT automatically revert — ask the user whether to revert or investigate
3. Proceed to the next file only after the user confirms

### 2.4 Report progress

After each file:
```
[2/8] Applied src/main/java/com/example/UserService.java — 4 fixes, tests passed
```

After all files:
```
Summary:
  Applied:  7 files
  Skipped:  1 file (tests failed — see above)
  Warnings: 2 fixes could not be located (before-code not found)
```

---

## Error Reference

| Symptom | Cause | Action |
|---|---|---|
| `command not found: sonarqube-prompt-factory` | Tool not installed globally | `cd <tool-repo> && uv tool install .` |
| `ConfigError: sonarqube_url is required` | Env var `SONARQUBE_URL` not set, no config file | User must set env var or provide config file |
| `ConfigError: project_key is required` | Not passed via `--project-key` and no config file | Ask user for project key |
| `openai.com is blocked` at startup | `llm_base_url` points to public OpenAI | User must set internal endpoint in env or config |
| SonarQube: FAILED (401) | Bad or expired token | User must refresh `SONARQUBE_TOKEN` env var |
| `_manifest.json` absent | Older tool version without manifest support | Fall back to ls glob (see 1.4) |
| Before-code not found in source | Source changed since SonarQube analysis | Log warning, continue; advise user to re-run analysis |
| LLM analysis failed for N files | Timeout or malformed LLM response | Check `failed_files` in manifest; rerun with `--verbose` |
| Tests fail after fix | Fix introduced a regression | Do NOT auto-revert; report to user and wait |
| SSL error during `uv tool install` | Corporate proxy intercepting PyPI | See SSL troubleshooting below |

---

## SSL Troubleshooting (Corporate Environments)

If `uv tool install` fails with SSL errors:

```bash
# Add to %APPDATA%\uv\uv.toml (Windows) or ~/.config/uv/uv.toml (Linux/Mac)
allow-insecure-host = ["pypi.org", "files.pythonhosted.org"]
```

Then retry `uv tool install .`.

If your company has an internal PyPI mirror, use that instead:

```toml
index-url = "https://nexus.yourcompany.com/repository/pypi/simple"
```

The `ca_bundle_path` in `config.yaml` handles SSL for SonarQube and LLM requests at
runtime — it is separate from uv's install-time SSL configuration.

---

## Notes

- Run the tool from the project root being analyzed. Relative paths in `config.yaml`
  (`output_dir`, `ca_bundle_path`) resolve against the working directory at invocation time.
- The tool fetches source code from SonarQube's API. If the local working copy has
  changed since the last SonarQube analysis, line numbers may be off. Best practice:
  run the tool immediately after a fresh SonarQube analysis.
- Files with 20+ fixes may have conflicts noted in the prompt file. Read the prompt's
  conflict warnings before applying.
- The tool does not access external AI services (openai.com is blocked by design).
  All LLM calls go to the configured internal endpoint.
