# Leafy

Calm, mobile-first plant care with Firebase and optional **photo identification** (Anthropic vision) behind a secure serverless API.

## Stack

- **Frontend:** Vite + React (deployed as static assets on Vercel)
- **Data:** Firebase / Firestore (`plants`, `watering_log`), multi-`groupId` via `?group=`
- **AI:** `POST /api/identify-plant` (Vercel serverless) — **API key never ships to the browser**

## Environment variables

### Client-safe (Vite — must use `VITE_` prefix)

These are embedded in the client bundle. **Do not put secrets here.**

| Variable | Purpose |
|----------|---------|
| `VITE_FIREBASE_*` | Firebase web app config (see `.env.example`) |
| `VITE_API_URL` | **Local dev only (optional):** origin where `/api` is served, e.g. `http://localhost:3000` when using `vercel dev`. Production same-origin requests use relative `/api/identify-plant` and do not need this. |

### Server-only (Vercel → Settings → Environment Variables)

**Never** use a `VITE_` prefix for these. They are only available to serverless functions.

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Required for photo identification |
| `ANTHROPIC_MODEL` | Optional override (default: `claude-sonnet-4-20250514`) |

**Never** set `ANTHROPIC_API_KEY` as `VITE_ANTHROPIC_API_KEY` — that would expose the key in client JS.

## AI photo flow (short)

1. User adds a photo; the client compresses it in `imagePrep.js` and `POST`s base64 + indoor/outdoor (+ optional name hint) to `/api/identify-plant`.
2. The server calls Anthropic and returns **JSON only** (`{ ok, result }` or `{ ok, error }`).
3. `normalizeAiPlantResult.js` validates and clamps model output into a safe care shape (intervals, copy, scene type).
4. **High confidence** (see `AUTO_SAVE_MIN_CONFIDENCE` in `normalizeAiPlantResult.js`): plant is saved and the drawer closes; a **“Care plan ready for …”** toast appears.
5. **Lower confidence / beds / mixed scenes:** a minimal in-drawer step: **Use this** or **Edit name**, then save — still **one card** per photo (no splitting into multiple plants).
6. **API/parse failure:** photo and form stay as-is; user can **save with a name** (rules engine). No client-side Anthropic calls.

## Local development

```bash
npm install
npm run dev
```

Photo ID needs the API route. Either:

- Run **`vercel dev`** and set `VITE_API_URL` in `.env` to that origin (Vite proxies `/api` when `VITE_API_URL` is set — see `vite.config.js`), or  
- Deploy a preview on Vercel and test there.

## Deploy on Vercel

1. Connect the repo; framework **Vite**; build `npm run build`; output `dist`.
2. Add **`ANTHROPIC_API_KEY`** (and optionally `ANTHROPIC_MODEL`) in project env vars for **Production** (and Preview if needed).
3. Ensure `vercel.json` rewrites keep `/api/*` hitting serverless routes (static files are still preferred when present).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
