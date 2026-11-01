# CoursePilot RAG — Portable Edition

Use the root `.cmd` launchers for maximum portability across Windows machines.

## Fastest flow (recommended)

From project root (`portable_coursepilot_shareable`):

1. Install everything (Python + frontend deps):

```bat
install_all.cmd
```

2. Build pipeline index (optional arg = slides folder):

```bat
run_pipeline.cmd "D:\path\to\your\slides"
```

If no argument is passed, it uses `pipeline\input\corpus`.

3. Start frontend:

```bat
run_frontend.cmd
```

Open: http://localhost:3000

---

## Why this is more portable

- No dependence on current folder (works even if you are not inside `scripts/`)
- Avoids PowerShell script-signing friction by using process-level bypass in launcher
- Uses project-local `.venv` automatically through underlying scripts

---

## Legacy PowerShell scripts (still available)

- `scripts/install_all.ps1`
- `scripts/run_pipeline.ps1`
- `scripts/run_frontend.ps1`

But client should prefer `.cmd` launchers above.
