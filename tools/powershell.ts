/**
 * OpenCode custom tool: powershell
 *
 * Mirrors the built-in `bash` tool but executes commands through PowerShell.
 * Works with both Windows-native pwsh/powershell.exe and PowerShell on WSL.
 *
 * Placement:
 *   Project-local  → .opencode/tools/powershell.ts
 *   Global         → ~/.config/opencode/tools/powershell.ts
 *
 * Dependencies: none beyond the Bun runtime that OpenCode already ships.
 *
 * Permission example (opencode.jsonc):
 *   { "permission": { "powershell": "ask" } }
 */

import { tool } from "@opencode-ai/plugin";
import { spawnSync } from "child_process";

// ---------------------------------------------------------------------------
// Resolve the PowerShell executable once at module load time.
// Priority: pwsh (cross-platform Core) → powershell (Windows inbox v5).
// On WSL both are usually available; prefer pwsh for consistency.
// ---------------------------------------------------------------------------
function resolvePwsh(): string {
  for (const candidate of ["pwsh", "pwsh.exe", "powershell", "powershell.exe"]) {
    const probe = spawnSync(candidate, ["-NoLogo", "-Command", "exit 0"], {
      timeout: 3000,
      windowsHide: true,
    });
    if (probe.status === 0) return candidate;
  }
  throw new Error(
    "No PowerShell executable found. Install pwsh (https://aka.ms/pscore6) or run on Windows."
  );
}

const PWSH = resolvePwsh();

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------
export default tool({
  description: `Execute a PowerShell command or script block in the project environment.

Use this tool when the task requires PowerShell-specific features:
- Windows registry, COM objects, WMI/CIM, .NET types
- PowerShell cmdlets (Get-ChildItem, Select-Object, Where-Object, etc.)
- Azure / AWS / other PS module ecosystems
- .ps1 scripts already present in the project

Rules:
- Use single-quoted strings for paths to avoid variable expansion surprises.
- Prefer absolute paths or context.directory-relative paths.
- For long-running processes, add a timeout via -TimeoutSec or the timeout_ms argument.
- Avoid interactive prompts (-Confirm, Read-Host); the shell is non-interactive.
- Multiline scripts are fine — pass them as a single string with \`\`\`\`n\`\`\`.
- On WSL, Windows paths must use the /mnt/c/... form or be escaped.`,

  args: {
    command: tool.schema
      .string()
      .describe("PowerShell command or script block to execute."),

    timeout_ms: tool.schema
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "Maximum execution time in milliseconds. Defaults to 30 000 (30 s). " +
          "Set higher for long build or install operations."
      ),

    working_directory: tool.schema
      .string()
      .optional()
      .describe(
        "Absolute path to run the command from. " +
          "Defaults to the session working directory (context.directory)."
      ),
  },

  async execute(args, context) {
    const timeoutMs = args.timeout_ms ?? 30_000;
    const cwd = args.working_directory ?? context.directory;

    // Wrap the user command so we capture both stdout+stderr
    // and get a reliable exit code even for terminating errors.
    // -NonInteractive + -NoProfile keeps startup fast and deterministic.
    const wrappedScript = `
$ErrorActionPreference = 'Stop'
try {
  ${args.command}
} catch {
  Write-Error $_.Exception.Message
  exit 1
}
`.trim();

    const result = spawnSync(
      PWSH,
      [
        "-NoLogo",
        "-NonInteractive",
        "-NoProfile",
        "-Command",
        wrappedScript,
      ],
      {
        cwd,
        timeout: timeoutMs,
        encoding: "utf8",
        windowsHide: true,
      }
    );

    // spawnSync sets error when the process cannot be spawned or times out.
    if (result.error) {
      if ((result.error as NodeJS.ErrnoException).code === "ETIMEDOUT") {
        return (
          `[powershell] Timed out after ${timeoutMs} ms.\n` +
          (result.stdout ? `stdout so far:\n${result.stdout}` : "")
        );
      }
      return `[powershell] Failed to spawn: ${result.error.message}`;
    }

    const stdout = (result.stdout ?? "").trimEnd();
    const stderr = (result.stderr ?? "").trimEnd();
    const exit   = result.status ?? 1;

    const parts: string[] = [];
    if (stdout) parts.push(stdout);
    if (stderr) parts.push(`[stderr]\n${stderr}`);
    if (exit !== 0) parts.push(`[exit ${exit}]`);

    return parts.length > 0 ? parts.join("\n") : "(no output)";
  },
});
