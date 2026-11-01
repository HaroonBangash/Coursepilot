# Portability Notes

## Changes made during portability refactor

1. Removed machine-specific runtime dependency in frontend bridge:
   - `frontend/src/lib/pipeline.ts`
   - From fixed `D:\\Rag Project\\.venv\\Scripts\\python.exe`
   - To env-driven `RAG_PYTHON_BIN` with fallback `python`

2. Rewrote pipeline path config to be environment/relative based:
   - `pipeline/config.py`
   - Uses:
     - `RAG_RAW_ROOT`
     - `RAG_DATA_DIR`
     - `RAG_EVAL_DIR`

3. Reset local app store state:
   - `frontend/data/app-data.json` reinitialized to empty store
   - avoids leaking absolute paths from previous machines

4. Excluded non-portable/generated folders from source copy:
   - `node_modules/`, `.next/`, `storage/`

5. Preserved key reproducibility outputs under `artifacts/`.

## Client handoff recommendation

- Zip and share only `portable_coursepilot/`
- Do not include your original `.env.local`
- Include a short onboarding note:
  - install Node + Python
  - create venv
  - install requirements
  - copy `.env.example` to `.env.local`
  - run `scripts/run_frontend.ps1`
