---
inclusion: always
---

# RTK — Rust Token Killer (Kiro)

**Usage**: Token-optimized CLI proxy for shell commands.

## Rule

Always prefix shell tool commands with `rtk` to minimize token consumption.

Examples:

```bash
rtk git status
rtk git diff
rtk git log
rtk git add .
rtk git commit -m "feat: message"
rtk git push
rtk jest --testPathPattern=src/tests-bdd
rtk lint
rtk tsc
rtk prisma generate
rtk pnpm list
rtk gh pr list
rtk gh pr view 42
rtk gh issue list
rtk docker ps
rtk docker logs
```

## Meta Commands

```bash
rtk gain              # Show token savings
rtk gain --history    # Command history with savings
rtk discover          # Find missed RTK opportunities
rtk proxy <cmd>       # Run raw (no filtering, for debugging)
```

## Fallback

If `rtk` is not installed (command not found), run the command without the `rtk` prefix. Do not fail or ask the user to install it.

## Exceptions

- Do NOT use `rtk` for Kiro built-in tools (read, grep, glob) — they bypass shell.
- Do NOT use `rtk` for interactive/long-running commands (`pnpm dev:swc`, `pnpm prisma:studio`).
- Use `rtk proxy <cmd>` when full unfiltered output is needed for debugging.

## Why

RTK filters and compresses command output before it reaches the LLM context, saving 60-90% tokens on common operations. Always use `rtk <cmd>` instead of raw commands.
