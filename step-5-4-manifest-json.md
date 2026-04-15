Module: prompt_writer
Spec: specs/prompt_writer.md
Step: 5.4
Dependencies: Steps 5.1–5.2 (write_prompt_file, write_summary, ProcessingSummary)
Prompt version: 2026-04-15

---

If any information required to implement this step is missing or ambiguous:
STOP. Ask a clarifying question. Do not infer, assume, or fill gaps.
Implement only what is explicitly specified in this prompt.
Do not add functionality beyond the scope of this step.

---

## Context

The following already exists and must not be modified:
- `src/sonarqube_prompt_factory/prompt_writer.py` — write_prompt_file, write_summary
- `src/sonarqube_prompt_factory/models.py` — ProcessingSummary, AnalysisResult, FixInstruction

The tool is installed globally via `uv tool install` and invoked from the target project's
working directory (e.g. `cd ~/projects/my-app && sonarqube-prompt-factory --config config.yaml`).
All paths in the manifest must be absolute so the consuming coding agent can locate files
regardless of its own working directory.

## Task

Add `write_manifest(summary: ProcessingSummary, output_dir: str, prompt_file_paths: list[str]) -> str`
to `prompt_writer.py`.

This function is always called after `write_summary`. It writes `_manifest.json` to
`output_dir` as a machine-readable index for coding agents consuming the generated prompts.

### Parameters

- `summary: ProcessingSummary` — same summary passed to write_summary
- `output_dir: str` — same output directory used throughout (already absolute, resolved
  by load_config at startup)
- `prompt_file_paths: list[str]` — the absolute paths returned by write_prompt_file, in the
  order they were written (which matches ProcessingSummary.results order, issue count descending)

### Output: `_manifest.json`

Write JSON with this exact structure:

```json
{
  "schema_version": "1",
  "timestamp": "<summary.timestamp>",
  "project_key": "<summary.project_key>",
  "sonarqube_url": "<summary.sonarqube_url>",
  "output_dir": "<absolute path of output_dir>",
  "total_issues": <summary.total_issues>,
  "total_files": <summary.total_files>,
  "successful_files": [
    {
      "file_path": "<result.file_path>",
      "prompt_file": "<basename of prompt_file_paths[i]>",
      "prompt_file_abs": "<absolute path from prompt_file_paths[i]>",
      "issue_count": <summary.original_issue_counts[result.file_path]>
    }
  ],
  "failed_files": [
    {
      "file_path": "<result.file_path>",
      "error": "<result.error>"
    }
  ]
}
```

Rules:
- `successful_files` contains entries for results where `success=True`, in the same order
  as `summary.results` (already sorted by issue count descending by the caller).
- `failed_files` contains entries for results where `success=False`.
- `prompt_file_paths` contains only paths for successful files, in the same order as
  the successful results in `summary.results`. Index alignment: `prompt_file_paths[i]`
  corresponds to the i-th successful result.
- Use `os.path.abspath(output_dir)` for the `output_dir` field.
- Use `os.path.basename(path)` for `prompt_file` and the raw path for `prompt_file_abs`.
- Write with `json.dumps(..., indent=2)` encoded as UTF-8.
- Return the absolute path of the written `_manifest.json` file.
- Raise `PromptWriteError` on I/O failure.

## Constraints

Do NOT:
- Add any fields not listed in the structure above
- Modify write_summary or write_prompt_file
- Add flags or options — this function always writes the manifest
- Import anything beyond `json`, `os`, and existing project imports

## Verification

- `_manifest.json` is valid JSON (json.loads succeeds)
- `successful_files[0]["issue_count"]` equals `original_issue_counts[first_successful_file_path]`
- `failed_files` is empty list (not absent) when all files succeed
- `successful_files` is empty list (not absent) when all files fail
- `output_dir` field is an absolute path
- `prompt_file_abs` is an absolute path (starts with `/` on Linux, drive letter on Windows)
- `schema_version` is the string `"1"`, not the integer 1

Run: `sonarqube-prompt-factory --help 2>&1 | head -1  # confirms global install`
Run: `uv run python -c "from sonarqube_prompt_factory.prompt_writer import write_manifest; print('OK')"`
