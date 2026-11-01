# MSc RAG Frontend (CoursePilot AI)

## Run locally

```bash
npm install
npm run dev
```

Open: `http://localhost:3000`

## Env

Create `.env.local`:

```bash
NEXT_PUBLIC_RAG_API_URL=http://localhost:8000
```

## Current scope

- Landing page (product-style hero + feature cards)
- Chat page with:
  - prompt chips
  - summary mode toggle
  - support-state badge (SUPPORTED/PARTIAL/INSUFFICIENT)
  - evidence panel (module/file/page/slide/snippet)

## Next integration step

Wire `askRag()` from `src/lib/api.ts` inside `ChatWorkspace.tsx` for live backend responses.
